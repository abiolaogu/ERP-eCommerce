# Low-Level Design (LLD)
## ERP-eCommerce — B2C/D2C eCommerce Platform
### Version 2.0 | March 2026

---

## 1. Checkout Flow Engine

### 1.1 Checkout Orchestration Pipeline

The checkout is a multi-step saga that coordinates address validation, shipping rate retrieval, tax calculation, discount application, payment authorization, inventory decrement, and order creation. Each step is independently retryable and the entire flow is idempotent.

```go
type CheckoutSession struct {
    ID               string
    TenantID         string
    CartID           string
    CustomerID       *string
    Email            string
    ShippingAddress  *Address
    BillingAddress   *Address
    ShippingMethod   *ShippingMethod
    TaxLines         []TaxLine
    DiscountCodes    []string
    PaymentIntent    *PaymentIntent
    Subtotal         Decimal
    DiscountTotal    Decimal
    ShippingTotal    Decimal
    TaxTotal         Decimal
    GrandTotal       Decimal
    State            CheckoutState
    ExpiresAt        time.Time
    CreatedAt        time.Time
    UpdatedAt        time.Time
}

type CheckoutState string
const (
    CheckoutCreated         CheckoutState = "created"
    CheckoutContactAdded    CheckoutState = "contact_added"
    CheckoutAddressAdded    CheckoutState = "address_added"
    CheckoutShippingSelected CheckoutState = "shipping_selected"
    CheckoutTaxCalculated   CheckoutState = "tax_calculated"
    CheckoutPaymentPending  CheckoutState = "payment_pending"
    CheckoutPaymentAuthorized CheckoutState = "payment_authorized"
    CheckoutCompleted       CheckoutState = "completed"
    CheckoutFailed          CheckoutState = "failed"
    CheckoutExpired         CheckoutState = "expired"
)
```

### 1.2 Step-by-Step Checkout Logic

**Step 1: Cart to Checkout (Cart -> Checkout Session)**
```
1. Validate cart is non-empty
2. Verify all cart items are still in stock (inventory check)
3. Re-calculate all prices (protect against price changes since cart creation)
4. Apply discount codes: validate code, check min purchase, check usage limits
5. Create checkout session with 30-minute expiration
6. Soft-reserve inventory for items (optional, configurable per merchant)
7. Emit event: checkout.started (for analytics and abandoned checkout recovery)
```

**Step 2: Contact Information**
```
1. Capture email (required) and phone (optional)
2. If customer is authenticated, pre-fill from profile
3. If email matches existing customer, offer login prompt
4. For guest checkout, store email on checkout session
5. Start abandoned checkout timer: if no progress in 1 hour, trigger recovery
```

**Step 3: Shipping Address**
```
1. If authenticated customer, show saved addresses as selectable cards
2. Address input with Google Places autocomplete
3. Address validation:
   a. Format standardization (USPS for US, Canada Post for CA)
   b. Deliverability check (reject PO boxes if merchant config prohibits)
   c. Country/region restriction check (does merchant ship here?)
4. If validation fails, show suggested corrections
5. Store validated address on checkout session
```

**Step 4: Shipping Method Selection**
```
1. Determine applicable shipping zone from ship-to address
2. Fetch available rates:
   a. Merchant-defined flat/weight/price-based rates from shipping_rates table
   b. If carrier-calculated: call carrier APIs (UPS, FedEx, USPS) in parallel
   c. Filter rates by weight, dimensions, and value constraints
3. Apply free shipping promotions if applicable
4. Display options sorted by price with estimated delivery dates:
   - Economy (5-7 business days): $4.99
   - Standard (3-5 business days): $7.99
   - Express (1-2 business days): $14.99
   - Free Standard (over $50 threshold): $0.00
5. Cache rates for 15 minutes per address+items combination
6. Update checkout totals with selected shipping cost
```

**Step 5: Tax Calculation**
```
1. Determine tax calculation method:
   a. If merchant uses Avalara/TaxJar: call external API with ship-to, items, tax codes
   b. If manual tax rules: look up rates from tax_rules table
2. Tax calculation inputs:
   - Ship-to address (state/province determines nexus)
   - Line items with product tax codes (standard, clothing, food, digital)
   - Shipping amount (taxable in some jurisdictions)
   - Discount allocation per line
3. Tax exemption check: if customer has exemption certificate, apply exemption
4. Return tax breakdown: [{jurisdiction, rate, amount}]
5. Update checkout grand total: subtotal - discounts + shipping + tax
```

**Step 6: Payment Authorization**
```
1. Create payment intent with gateway:
   - Stripe: stripe.paymentIntents.create({amount, currency, metadata})
   - PayPal: POST /v2/checkout/orders
2. Return client_secret to frontend for client-side tokenization
3. Frontend collects payment via gateway SDK (Stripe Elements, PayPal Buttons)
4. Frontend confirms payment (3D Secure challenge if required)
5. Backend receives webhook: payment_intent.succeeded or payment.authorized
6. Verify amount matches checkout total (prevent tampering)
7. Transition checkout to payment_authorized state
```

**Step 7: Order Creation**
```
1. Begin database transaction:
   a. Decrement inventory for each line item (SELECT FOR UPDATE + UPDATE)
   b. If inventory insufficient: return error, suggest alternatives, or allow oversell if policy = 'continue'
   c. Create order record with all details
   d. Create order_lines from cart items with price snapshots
   e. Create payment record linked to order
   f. Assign sequential order_number per tenant
   g. Clear cart (mark as converted)
   h. Mark checkout session as completed
2. Commit transaction
3. Post-commit async events:
   a. Send order confirmation email with receipt
   b. Emit order.created event to MessageBus
   c. Send analytics event (purchase conversion)
   d. Fire marketing pixels (Meta CAPI, GA4 Measurement Protocol)
   e. Trigger fulfillment workflow
   f. Update customer aggregates (total_orders, total_spent, last_order_at)
```

### 1.3 Express Checkout (Apple Pay / Google Pay)

```
Express checkout skips Steps 2-4:
1. Customer taps Apple Pay / Google Pay button on cart page
2. Wallet provides: email, shipping address, payment token
3. Backend: validate address, calculate shipping (use cheapest available), calculate tax
4. Display total in wallet sheet for customer confirmation
5. On confirm: authorize payment, create order (Steps 6-7)
6. Total checkout time: ~10 seconds vs. ~120 seconds for standard checkout
```

---

## 2. Recommendation Engine

### 2.1 Collaborative Filtering (Item-to-Item)

```
Goal: "Customers who bought X also bought Y"

Algorithm: Item-based collaborative filtering using co-purchase matrix

Offline (Nightly Batch):
1. Extract purchase pairs: for each order, generate all (item_a, item_b) pairs
2. Build co-purchase matrix: count of orders containing both item_a and item_b
3. Calculate similarity using cosine similarity:
   sim(a,b) = co_purchases(a,b) / sqrt(purchases(a) * purchases(b))
4. For each product, store top 20 most similar products in Redis:
   Key: "rec:copur:{tenant}:{product_id}"
   Value: sorted set of {product_id: similarity_score}
5. Decay: weight recent purchases more heavily (exponential decay, half-life 90 days)

Online (Request Time):
1. Input: product_id (or list of cart items)
2. Fetch precomputed similar products from Redis
3. If cart context: merge recommendations across all cart items, deduplicate, sort by aggregate score
4. Filter: remove out-of-stock, remove products already in cart, respect collection visibility
5. Return top N recommendations
```

### 2.2 Content-Based Similarity

```
Goal: "Similar products to X" based on product attributes

Algorithm: TF-IDF + cosine similarity on product text features

Offline (On Product Create/Update):
1. Create feature vector for each product:
   - Title tokens (TF-IDF weighted)
   - Description tokens (TF-IDF weighted, lower weight)
   - Category (one-hot encoded)
   - Tags (binary features)
   - Price bucket (normalized)
   - Vendor (one-hot encoded)
2. Calculate pairwise cosine similarity between all products within tenant
3. Store top 20 similar products per product in Redis:
   Key: "rec:similar:{tenant}:{product_id}"

Cold-Start Handling:
- New products immediately get content-based recommendations (no purchase data needed)
- As purchase data accumulates, collaborative filtering blends in with increasing weight
- Blend formula: final_score = alpha * CF_score + (1-alpha) * CB_score
  where alpha = min(purchases_count / 50, 0.8)
```

### 2.3 Personalized Recommendations

```
Goal: "Recommended for you" based on individual customer behavior

Algorithm: User-item affinity scoring

Feature Vector per Customer:
- Category affinity: normalized purchase count per category
- Price sensitivity: average price paid / browse price ratio
- Brand affinity: normalized purchase count per vendor
- Recency: weighted recent views and purchases (exponential decay)
- Segment membership: high-value, discount-sensitive, new customer, etc.

Scoring:
For each candidate product:
  score = category_match * 0.3 + brand_match * 0.2 + price_match * 0.2
        + popularity * 0.15 + recency_boost * 0.15

Where:
  category_match = customer's affinity score for product's category
  brand_match = customer's affinity score for product's vendor
  price_match = 1 - abs(product_price - customer_avg_price) / customer_avg_price
  popularity = log(product_purchases_last_30d + 1) / max_popularity
  recency_boost = if product_viewed_in_last_7d then 1.5 else 1.0

Return top 20 scored products, filtered for out-of-stock and already-purchased
```

### 2.4 Trending Products

```
Algorithm: Velocity-weighted popularity

Calculation (every 15 minutes):
1. For each product, calculate purchase velocity:
   velocity_1h = purchases_last_1_hour / avg_hourly_purchases_last_7_days
   velocity_24h = purchases_last_24_hours / avg_daily_purchases_last_30_days
2. Trending score = velocity_1h * 0.6 + velocity_24h * 0.4
3. Products with trending_score > 2.0 are "trending"
4. Sort by trending_score descending, cache top 50 per tenant
5. Key: "rec:trending:{tenant}" → sorted set
```

---

## 3. Personalization Engine

### 3.1 Customer Segmentation

```
Segment Definition Schema:
{
  "name": "High-Value Loyal",
  "rules": {
    "operator": "AND",
    "conditions": [
      {"field": "total_spent", "op": "gte", "value": 500},
      {"field": "total_orders", "op": "gte", "value": 5},
      {"field": "days_since_last_order", "op": "lte", "value": 60}
    ]
  }
}

Predefined Segments:
1. New Customers: total_orders == 1 AND days_since_first_order <= 30
2. Loyal Customers: total_orders >= 5 AND days_since_last_order <= 90
3. High-Value: total_spent >= top 10% threshold for tenant
4. At-Risk: total_orders >= 3 AND days_since_last_order BETWEEN 60 AND 120
5. Dormant: days_since_last_order > 120
6. Discount-Sensitive: orders_with_discount / total_orders > 0.6
7. Subscribers: has_active_subscription == true

Segment Evaluation:
- Segments evaluated at request time against customer profile
- Customer can belong to multiple segments simultaneously
- Segment membership cached in Redis for 1 hour per customer
- Segment counts recalculated hourly for merchant analytics
```

### 3.2 Content Variant Selection

```
Content Personalization Pipeline:

1. Storefront renders page with personalization slots:
   <PersonalizedSection section="hero" />
   <PersonalizedSection section="featured_collection" />
   <PersonalizedSection section="product_recs" />

2. Client-side JS requests personalized content:
   GET /api/v1/personalize?sections=hero,featured_collection,product_recs

3. Backend resolves customer segments (from JWT or session)

4. For each section, evaluate content rules:
   Content Rule: {
     section: "hero",
     variants: [
       {segment: "new_customer", content: {banner: "welcome_10_off.jpg", cta: "Get 10% Off"}},
       {segment: "loyal_customer", content: {banner: "loyalty_exclusive.jpg", cta: "Shop Exclusives"}},
       {segment: "dormant", content: {banner: "we_miss_you.jpg", cta: "Come Back for 20% Off"}},
       {segment: "default", content: {banner: "seasonal.jpg", cta: "Shop New Arrivals"}}
     ]
   }

5. First matching segment wins (priority ordered)

6. If A/B test active on this section:
   - Hash(customer_id + experiment_id) % 100 → bucket
   - Serve control or variant based on bucket assignment
   - Log experiment impression for statistical analysis
```

### 3.3 A/B Testing Statistical Engine

```
Test Configuration:
{
  "experiment_id": "checkout_button_color",
  "variants": [
    {"id": "control", "weight": 50, "config": {"button_color": "#1677ff"}},
    {"id": "variant_a", "weight": 50, "config": {"button_color": "#52c41a"}}
  ],
  "goal": "purchase_conversion_rate",
  "min_sample_size": 1000,
  "confidence_level": 0.95,
  "max_duration_days": 30
}

Statistical Analysis (Bayesian):
- Prior: Beta(1, 1) (uninformative)
- Posterior per variant: Beta(1 + conversions, 1 + visitors - conversions)
- Probability of being best: Monte Carlo simulation (10,000 samples from each posterior)
- Report: P(variant_a > control), expected lift, 95% credible interval

Auto-Stop Rules:
1. If P(best) > 0.95 AND sample_size > min_sample_size → declare winner
2. If expected lift < 0.5% AND sample_size > 2x min → declare no significant difference
3. If max_duration_days reached → end experiment, report final results
```

---

## 4. Search Engine Integration

### 4.1 Product Search Indexing

```
Sync Pipeline (CDC → Meilisearch):

1. PostgreSQL trigger on products/variants INSERT/UPDATE/DELETE
2. Change event published to MessageBus: product.updated
3. Search indexer consumer:
   a. Fetch full product with variants, collections, reviews
   b. Build search document:
      {
        "id": "product_uuid",
        "tenant_id": "tenant_123",
        "title": "Organic Cotton T-Shirt",
        "description": "Soft, sustainable tee...",
        "vendor": "EcoWear",
        "product_type": "Apparel",
        "tags": ["organic", "cotton", "basics"],
        "collections": ["summer-collection", "sale"],
        "variants": [
          {"title": "Small / White", "sku": "ECO-TS-SM-WH", "price": 29.99, "available": true},
          {"title": "Medium / White", "sku": "ECO-TS-MD-WH", "price": 29.99, "available": true}
        ],
        "min_price": 29.99,
        "max_price": 29.99,
        "avg_rating": 4.6,
        "review_count": 128,
        "total_sales": 3450,
        "created_at": 1709251200,
        "image_url": "https://cdn.../tshirt.webp"
      }
   c. Upsert to Meilisearch index

4. Index settings:
   - Searchable attributes: title, description, vendor, tags, variants.sku (priority ordered)
   - Filterable attributes: vendor, product_type, tags, collections, min_price, avg_rating, available
   - Sortable attributes: min_price, avg_rating, total_sales, created_at
   - Ranking rules: words, typo, proximity, attribute, sort, exactness, custom (total_sales:desc)
```

### 4.2 Search Query Processing

```
Query Pipeline:
1. Parse query string: extract terms, detect filters (e.g., "red dress under $50")
2. Apply typo tolerance: up to 1 typo for 1-4 char words, 2 typos for 5+ chars
3. Apply synonyms: "tee" → "t-shirt", "sneakers" → "shoes"
4. Execute search against Meilisearch with tenant_id filter
5. Apply merchant-specific boosting rules (pinned products, vendor boost)
6. Return results with facet counts for filter UI
7. Log search event for analytics: query, results_count, customer_id, session_id
```

---

## 5. Subscription Billing Pipeline

### 5.1 Billing Scheduler

```
Daily Cron (runs at 00:00 UTC):

1. Query subscriptions due for billing:
   SELECT * FROM subscriptions
   WHERE status = 'active'
     AND next_billing_at <= NOW()
     AND dunning_attempts < max_dunning_attempts

2. For each subscription:
   a. Build order from subscription items (current prices with discount applied)
   b. Create payment intent with stored payment method token
   c. If payment succeeds:
      - Create order record
      - Update next_billing_at = current + frequency
      - Reset dunning_attempts = 0
      - Send renewal confirmation email
      - Emit event: subscription.renewed
   d. If payment fails:
      - Increment dunning_attempts
      - Schedule retry based on dunning sequence:
        Attempt 1: retry in 1 day
        Attempt 2: retry in 3 days (send "Update payment" email)
        Attempt 3: retry in 7 days (send "Action required" email)
        Attempt 4: retry in 14 days (send "Final notice" email)
      - If max_attempts reached:
        Set status = 'cancelled'
        Send cancellation email
        Emit event: subscription.cancelled_payment_failure
```

### 5.2 Subscriber Self-Service Actions

```
Skip Next Delivery:
1. Validate: subscription.status == 'active'
2. Validate: next_billing_at > now() + min_skip_notice (default 2 days)
3. Set next_billing_at = next_billing_at + frequency (push to following cycle)
4. Create subscription_order record with status = 'skipped'
5. Send confirmation email

Swap Product:
1. Validate: new variant exists, is in stock, and is subscription-eligible
2. Update subscription_items: replace old variant_id with new
3. Recalculate subscription price (new variant price * quantity * (1 - discount_pct))
4. Send confirmation email with updated details

Pause Subscription:
1. Validate: subscription.status == 'active'
2. Set status = 'paused', paused_at = now()
3. Set resume_at = now() + pause_duration (max 90 days)
4. Background job resumes automatically at resume_at
5. Send pause confirmation with resume date

Cancel with Retention:
1. Show retention offers in sequence:
   a. "Would you like to pause instead?" → if accepted, pause for 30 days
   b. "How about 15% off your next 3 deliveries?" → if accepted, apply discount
   c. "Would you prefer a different product?" → if accepted, show swap UI
2. If all declined: record cancellation_reason from exit survey
3. Set status = 'cancelled', cancelled_at = now()
4. Send cancellation confirmation with "reactivate" link
```

---

## 6. Cart Abandonment Recovery

### 6.1 Recovery Pipeline

```
Event: cart.updated (item added or checkout started, then no activity)

Recovery Sequence:
Timer 1 (1 hour after last activity):
  - Check: cart still has items AND no order created from this cart
  - Action: Send Email #1 (reminder)
    Subject: "You left something in your cart"
    Content: Cart items with images, prices, "Complete your purchase" CTA
    Include: abandoned_checkout_url (pre-fills cart and checkout)

Timer 2 (24 hours):
  - Check: cart still abandoned
  - Action: Send Email #2 (social proof)
    Subject: "Still thinking about it?"
    Content: Cart items + review snippets + "X people bought this today"

Timer 3 (48 hours):
  - Check: cart still abandoned
  - Action: Send Email #3 (incentive)
    Subject: "Here's 10% off to complete your order"
    Content: Cart items + auto-generated discount code (single-use, 7-day expiry)
    Note: Discount percentage configurable per merchant

Timer 4 (7 days):
  - Mark cart as expired
  - Update analytics: abandoned_cart → expired

Attribution:
  - If customer completes purchase within 30 days of recovery email:
    Track: recovery_email_number, time_to_convert, order_value
    Mark cart as recovered = true
  - Report recovery rate and recovered revenue per email in analytics
```

---

## 7. Storefront Rendering Pipeline

### 7.1 SSR/ISR Flow

```
Request Flow:
1. CDN receives request for storefront page
2. Cache check: if cached page exists and not stale → serve from edge (TTFB <50ms)
3. Cache miss or stale:
   a. Route to Storefront Renderer service
   b. Load page configuration (JSON) from cache or database
   c. Resolve data requirements:
      - Product page: fetch product, variants, images, reviews, recommendations
      - Collection page: fetch collection products with pagination
      - Homepage: fetch featured collections, promotions, hero content
   d. Render HTML using template engine with resolved data
   e. Inline critical CSS (above-the-fold styles)
   f. Set cache headers: Cache-Control: s-maxage=300, stale-while-revalidate=60
   g. Return HTML to CDN, CDN caches and serves

4. Client-side hydration (after initial HTML render):
   a. Load React/JS bundle
   b. Hydrate interactive components (cart, search, add-to-cart buttons)
   c. Fetch personalized sections via API (recommendations, recently viewed)
   d. Initialize analytics tracking (page view event)

ISR Invalidation:
  - Product updated → invalidate product page and related collection pages
  - Collection updated → invalidate collection page
  - Theme/builder change → invalidate all pages for store
  - Promotion starts/ends → invalidate affected pages
  - Purge via API: POST /api/v1/cache/purge?pattern=*
```

---

## 8. Error Handling and Resilience

### 8.1 Checkout Resilience

| Failure Scenario | Handling |
|-----------------|----------|
| Shipping rate API timeout | Return cached rates if <15 min old; otherwise show "rates unavailable, try again" |
| Tax API timeout | Fall back to manual tax rules; flag order for tax reconciliation |
| Payment authorization fails | Show error message, allow retry with different payment method |
| Inventory decremented but order creation fails | Compensation: re-increment inventory, notify customer |
| Payment authorized but order creation fails | Create order asynchronously from payment webhook; worst case: refund |
| Email delivery fails | Queue for retry (3 attempts); order is still valid |

### 8.2 Circuit Breakers

| Service | Open After | Half-Open After | Close After |
|---------|-----------|-----------------|-------------|
| Payment Gateway | 3 failures in 30s | 30s | 2 consecutive successes |
| Tax API | 5 failures in 60s | 60s | 3 consecutive successes |
| Shipping Rate API | 5 failures in 60s | 60s | 3 consecutive successes |
| Search Engine | 10 failures in 60s | 30s | 5 consecutive successes |
| Recommendation API | 10 failures in 60s | 30s | 5 consecutive successes |
| Email Service | 5 failures in 60s | 120s | 3 consecutive successes |

### 8.3 Graceful Degradation

```
If Search Engine down → fall back to PostgreSQL full-text search (slower but functional)
If Recommendation Engine down → show "Popular Products" (pre-cached static list)
If Tax API down → use manual tax rules (conservative rates)
If CDN down → serve directly from origin (higher latency)
If Payment Gateway down → show "Payment temporarily unavailable" + offer PayPal/alternative
```

---

*Document Classification: Internal — Confidential*
*Last Updated: March 2026*
*Owner: Engineering — eCommerce Platform*
