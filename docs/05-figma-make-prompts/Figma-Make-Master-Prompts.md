# Figma Make Master Prompts
## ERP-eCommerce — B2C/D2C eCommerce Platform UI/UX
### Version 2.0 | March 2026

---

## Inputs to Attach Before Prompting

Before using these prompts in Figma or Make, attach the following documents for full context:
1. PRD — personas (Merchant, Marketer, Consumer, Store Designer, Operations Manager), features, workflows
2. HLD — service architecture, storefront rendering, recommendation engine
3. Data Architecture — entity relationships, field definitions
4. LLD — checkout flow, recommendation algorithms, personalization, subscription billing

---

## Prompt 1: Merchant Dashboard (GMV, Conversion, AOV)

```
Design a comprehensive Merchant Dashboard for the ERP-eCommerce platform (port 5192).

TOP-LEVEL LAYOUT:
- Left sidebar (220px): Navigation with sections — Dashboard, Orders, Products, Customers,
  Analytics, Marketing, Content (Storefront Builder), Subscriptions, Settings
- Top bar: Store name + logo, store status indicator (live/maintenance), notification bell,
  quick search (orders/products/customers), merchant avatar + dropdown

DASHBOARD HOME:
- Date range selector (today, 7d, 30d, 90d, custom) with comparison toggle (vs. previous period)
- Hero KPI cards row (4 cards):
  1. Total Sales: $XX,XXX (with % change vs. previous period, green/red arrow)
  2. Orders: XXX (with % change)
  3. Conversion Rate: X.X% (with % change)
  4. Average Order Value: $XX.XX (with % change)

- Revenue chart (large, prominent):
  - Area chart showing daily/weekly revenue over selected period
  - Toggle between: Revenue, Orders, Visitors, Conversion Rate
  - Overlay comparison line for previous period
  - Hover tooltip with exact values

- Secondary metrics row:
  - Online Sessions: XXX (with sparkline mini-chart)
  - Returning Customer Rate: XX%
  - Cart Abandonment Rate: XX%
  - Abandoned Cart Recovery Revenue: $X,XXX

- Sales by Channel: Horizontal bar chart (Web, Mobile, Social, API/Headless)
- Top Products: Table showing top 10 products by revenue (image, name, units sold, revenue)
- Top Traffic Sources: Table (source, sessions, orders, conversion rate, revenue)
- Recent Orders: Live feed showing last 10 orders with customer name, amount, status

LIVE VIEW (real-time):
- Active visitors counter with global map showing visitor locations
- Live order stream (new orders appear with slide-in animation)
- Real-time conversion funnel: Visitors → Product Views → Add to Cart → Checkout → Purchase

Design for data-hungry D2C brand founders who check their dashboard multiple times per day.
Use Ant Design v5 components. Color palette: #6366F1 (Indigo primary), white backgrounds,
subtle gray borders. Charts use Ant Design Charts (G2) with smooth animations.
Dark mode support. Mobile-responsive for tablet/phone checking.
```

---

## Prompt 2: Storefront Builder

```
Design a Visual Storefront Builder (WYSIWYG page editor) for merchants.

BUILDER LAYOUT:
- Left panel (280px): Component library and page structure
  - Tab 1: Sections (draggable): Hero Banner, Featured Collection, Product Grid,
    Image + Text, Testimonials, Newsletter Signup, Video, FAQ, Custom HTML,
    Countdown Timer, Instagram Feed, Logo Bar (brands)
  - Tab 2: Page Tree (layers panel): hierarchical view of all sections on page
    with visibility toggles, reorder via drag-and-drop, lock, and duplicate

- Center: Live preview canvas
  - Responsive viewport toggles (Desktop 1440px, Tablet 768px, Mobile 375px)
  - Direct-on-canvas click to select sections
  - Section drag handles for reordering
  - Inline text editing (click to edit headlines and body text)
  - "Add Section" dividers between sections (+ button appears on hover)

- Right panel (300px): Section settings (appears when section selected)
  - Tab 1: Content: section-specific fields (headline, body, image upload,
    collection picker, product picker, CTA text, CTA link)
  - Tab 2: Style: background color/image/gradient, padding (top/bottom),
    text alignment, font size overrides, animation on scroll
  - Tab 3: Visibility: show/hide per device (desktop/tablet/mobile),
    show to customer segment (new/returning/subscriber), schedule (show between dates)

GLOBAL THEME SETTINGS (accessible from builder toolbar):
- Colors: Primary, Secondary, Accent, Background, Text, Link (live preview on change)
- Typography: Heading font, Body font, font sizes scale
- Logo upload (header + favicon)
- Header: layout (centered/left-aligned), navigation menu builder (drag-and-drop links),
  announcement bar with dismiss
- Footer: column layout (3-4 columns), links, social icons, payment icons, copyright

PAGE MANAGEMENT:
- Page list: Homepage, Product Page, Collection Page, Cart, About, Contact, FAQ, Blog, Custom pages
- Each page shows template assignment and last-edited timestamp
- Create new page with URL slug and SEO fields
- Duplicate page for A/B testing

VERSION HISTORY:
- Timeline showing all saved versions with timestamp and editor name
- Click version to preview (side-by-side comparison view)
- "Restore this version" button with confirmation
- Auto-save every 30 seconds with debouncing

Use a Figma/Canva-inspired builder aesthetic: clean white canvas, minimal chrome,
floating toolbars. Drag operations should show insertion guides (blue lines).
Preview should be pixel-perfect to actual storefront rendering.
```

---

## Prompt 3: Product Page Designer

```
Design the Product Page management interface AND the consumer-facing product page template.

MERCHANT-SIDE: Product Edit View
- Left column (60%):
  - Title (large text input)
  - Description (rich text editor with formatting, image embed, video embed)
  - Media gallery: drag-and-drop image/video upload, reorder, alt text editor,
    crop tool, primary image designation; support for 3D model viewer placeholder
  - Pricing section: Price, Compare-at price (for strike-through), Cost per item,
    Profit and margin auto-calculated and displayed
  - Inventory: Track quantity toggle, SKU, Barcode, quantity input per location
  - Shipping: Weight, dimensions, requires shipping toggle, HS code for international

- Right column (40%):
  - Status: Draft / Active / Archived selector
  - Organization: Product type, Vendor, Tags (pill input with autocomplete),
    Collections (multi-select with search)
  - Variants section:
    - Option axes (e.g., Size: S, M, L, XL | Color: Red, Blue, Black)
    - "Generate variants" button → variant table with per-variant: price, SKU,
      barcode, inventory, image assignment, active toggle
    - Bulk edit variant prices/inventory
  - SEO preview: title tag, meta description, URL slug (editable)
    with Google search result preview
  - Metafields: key-value custom data (ingredients, care instructions, etc.)

CONSUMER-FACING: Product Detail Page
- Image gallery (left 50%): Large hero image with thumbnail strip below,
  zoom on hover, swipe on mobile, video playback inline
- Product info (right 50%):
  - Title (H1), vendor name (link to vendor collection)
  - Rating stars (4.6 out of 5) with review count (link to reviews section)
  - Price: sale price in bold + compare-at with strikethrough
  - Variant selectors: visual swatches for color (circles with color fill),
    button group for size, unavailable options shown as crossed-out
  - Quantity selector (+ / - buttons)
  - "Add to Cart" primary button (full width, prominent)
  - "Buy Now" secondary button (express checkout)
  - "Add to Wishlist" icon button
  - Subscribe option: "Subscribe & Save 15%" with frequency dropdown,
    switches price display to subscription price
  - Description tabs: Description | Ingredients/Specs | Shipping & Returns
  - Trust badges row: Free Shipping, 30-Day Returns, Secure Checkout icons

- Below fold:
  - "You may also like" recommendation carousel (4 products)
  - "Frequently bought together" bundle suggestion with combined price
  - Customer Reviews section:
    - Summary: rating distribution bar chart, average rating
    - Filter by rating (5,4,3,2,1 stars)
    - Individual review cards: stars, title, body, reviewer name, date,
      verified purchase badge, helpful button, review photos
    - "Write a Review" CTA

Design for conversion optimization. Every element should reduce friction or increase trust.
Mobile-first: the product page should be excellent on mobile (60% of traffic).
```

---

## Prompt 4: Checkout Customizer

```
Design the consumer-facing checkout page AND the merchant's checkout configuration UI.

CONSUMER CHECKOUT (single-page, optimized):
- Progress indicator: Information → Shipping → Payment (horizontal steps)
- Express checkout buttons at top: Apple Pay, Google Pay, PayPal (prominent)
- Divider: "OR" separator between express and manual checkout

- Section 1 — Contact:
  - Email input (with existing customer detection: "Already have an account? Log in")
  - Phone number (optional, for SMS order updates)
  - Marketing consent checkbox

- Section 2 — Shipping Address:
  - Saved addresses (for logged-in users): selectable cards
  - New address form: First/Last name, Address (with Google Places autocomplete),
    Apt/Suite, City, State (dropdown), ZIP, Country (dropdown)
  - "Save this address" checkbox

- Section 3 — Shipping Method:
  - Radio options showing: Carrier icon, Method name, Estimated delivery date range, Price
  - Free shipping highlighted if applicable ("Free" in green)
  - Shipping cost updates live when address changes

- Section 4 — Payment:
  - Card input (Stripe Elements embedded): Card number, Expiry, CVC, Name on card
  - Alternative payment methods: PayPal button, Affirm/Klarna BNPL option with "4 payments of $X"
  - Gift card input (expandable)
  - Discount code input (expandable)
  - Billing address: "Same as shipping" checkbox (default checked)

- Order Summary sidebar (right, 35%):
  - Line items with thumbnails, quantities, prices
  - Subtotal, Discount (with code shown), Shipping, Tax
  - Total (prominent, large font)
  - "Place Order" button (full width, high contrast)
  - Trust badges and security icons below button

MERCHANT CHECKOUT CONFIGURATION:
- Settings panel:
  - Guest checkout: toggle on/off
  - Express payment methods: toggle Apple Pay, Google Pay, PayPal individually
  - Required fields: phone number (required/optional/hidden)
  - Custom fields: add fields (gift wrapping, delivery instructions) with field type selector
  - Checkout branding: logo, accent color, background color
  - Post-purchase page: configure cross-sell recommendations, newsletter signup, social share
  - Abandoned checkout settings: recovery email timing, discount offer amount
  - Checkout scripts: custom script injection for analytics/attribution

Design checkout for maximum conversion. Every unnecessary field is friction.
Form fields should have clear labels, validation on blur, and friendly error messages.
Auto-advance to next section on completion. Show order total updating in real-time.
Mobile checkout should be single-column with large touch targets.
```

---

## Prompt 5: Analytics (Funnel, Cohort, LTV)

```
Design an Analytics Dashboard with funnel analysis, cohort analysis, and LTV reporting.

ANALYTICS OVERVIEW:
- Period selector with comparison (same UI pattern as main dashboard)
- Summary cards: Total Revenue, Total Orders, Unique Customers, Sessions,
  Conversion Rate, AOV, Returning Customer %, Email Subscribers

CONVERSION FUNNEL:
- Visual funnel chart (wide at top, narrow at bottom):
  1. Sessions: XX,XXX (100%)
  2. Product Page Views: XX,XXX (XX% of sessions)
  3. Add to Cart: X,XXX (XX% of product views)
  4. Checkout Started: X,XXX (XX% of add to cart)
  5. Checkout Completed: X,XXX (XX% of checkout started)
- Drop-off percentages between each step highlighted in red
- Click on any step → detail view showing top products, sources, and devices at that step
- Filter funnel by: date range, traffic source, device type, new vs. returning, campaign

COHORT ANALYSIS:
- Monthly cohort retention grid (heatmap style):
  - Rows: acquisition month cohort (Jan 2026, Feb 2026, etc.)
  - Columns: Month 0, Month 1, Month 2, ... Month 12
  - Cells: retention rate (% of cohort who purchased again) with color intensity
  - Hover: show absolute numbers (retained customers / cohort size)
- Cohort metric selector: Retention (default), Revenue per customer, Orders per customer
- Cohort filter: by acquisition channel, first product category, subscription status

CUSTOMER LIFETIME VALUE (LTV):
- LTV Distribution: histogram showing customer LTV distribution with median and mean lines
- LTV by Acquisition Channel: bar chart (Organic, Paid Social, Email, Direct, Referral)
  with CAC overlay showing LTV:CAC ratio per channel
- LTV by Cohort: line chart showing cumulative LTV curves per cohort over time
  (how quickly do different cohorts reach profitability)
- Projected LTV: ML-predicted LTV per customer segment with confidence intervals
- LTV Table: sortable table (Customer Segment, Customer Count, Avg LTV, Avg Orders,
  Avg Revenue per Order, Avg Days Between Orders, Predicted LTV at 12mo/24mo)

PRODUCT ANALYTICS:
- Product performance table: Product, Views, Add-to-Cart Rate, Purchase Rate,
  Revenue, Avg Rating, Return Rate
- Product funnel: for selected product, show view → ATC → purchase conversion
- Search analytics: Top queries, Zero-result queries, Click-through rate per query

SUBSCRIPTION ANALYTICS:
- MRR chart (line chart over time with new, expansion, contraction, churned breakdown)
- Churn rate: monthly churn with trend line
- Subscriber cohort retention: same grid format as customer cohorts but for subscribers
- Revenue per subscriber over time

Use professional data visualization patterns. Tables should be exportable to CSV.
Charts should support hover tooltips with precise values. Dashboard should load fast
(skeleton loaders for charts). Include date comparisons (vs. previous period overlays).
Color palette: blues and grays for standard data, green for positive metrics, red for negative.
```

---

## Prompt 6: Marketing Campaign Builder

```
Design a Marketing Campaign Builder interface for D2C brand marketers.

CAMPAIGN LIST:
- Table: Campaign Name, Type (Discount/Flash Sale/Gift Card/Email), Status
  (Draft/Scheduled/Active/Ended), Start Date, End Date, Revenue Attributed,
  Orders, Discount Usage / Limit
- Quick filters: Active, Scheduled, Ended, All
- "Create Campaign" button → campaign type selector

DISCOUNT CAMPAIGN BUILDER:
- Step 1 — Campaign Details:
  - Name, description, campaign period (start/end with time picker)
  - Discount type: Percentage Off, Fixed Amount Off, Free Shipping, BOGO
  - Discount value input (e.g., 20% or $10)
  - Code type: Specific Code (enter code) or Auto-Generated (quantity + prefix)

- Step 2 — Conditions:
  - Applies to: All Products, Specific Products (search + multi-select),
    Specific Collections (search + multi-select)
  - Minimum purchase: amount threshold or item count threshold
  - Customer eligibility: All Customers, Specific Segments (multi-select),
    Specific Customers (search)
  - Usage limits: Total uses, Uses per customer
  - Stackable with other discounts: toggle

- Step 3 — Preview:
  - Summary card showing all configured rules
  - Estimated impact: based on historical data, estimate orders affected and revenue impact
  - Promotional display preview: how the discount appears on product page, cart, checkout
  - "Activate Campaign" or "Schedule" button

FLASH SALE BUILDER:
- Product selection with sale prices and inventory limits per product
- Countdown timer configuration (display start before sale, during sale)
- Landing page template (auto-generated from selected products)
- Capacity planning: estimated traffic multiplier, infrastructure readiness indicator
- Early access: option to give subscribers or specific segments early access

GIFT CARD MANAGEMENT:
- Create gift card: denomination options, custom amounts, design template
- Gift card list: Code, Value, Balance, Status, Recipient, Purchaser, Created Date
- Gift card analytics: sold value, redeemed value, outstanding balance (liability)

EMAIL/SMS CAMPAIGN:
- Template builder: drag-and-drop email editor with product blocks, discount blocks,
  image blocks, text blocks, button blocks
- Dynamic content: product recommendations, customer name, discount code personalization
- Audience: segment selector with estimated reach count
- Schedule: send now or schedule for future date/time
- Preview: desktop and mobile email preview
- A/B test: subject line variants with auto-send winner after test period

CAMPAIGN ANALYTICS:
- Per-campaign performance: Revenue attributed, Orders, Discount used (count and $),
  New customers acquired, ROI
- Campaign comparison: overlay multiple campaigns on same chart for benchmarking
- Discount code analytics: top codes by usage, revenue impact, repeat purchase rate
  of customers who used codes

Design for marketing professionals who are visual thinkers and data-driven.
Make the campaign builder feel empowering, not restrictive. Use progress indicators
for multi-step builders. Show estimated impact wherever possible.
Color palette aligned with main dashboard (#6366F1 Indigo primary).
```

---

## Design System Notes

- **Primary Color**: #6366F1 (Indigo)
- **Component Library**: Ant Design v5
- **Typography**: Inter for UI, system fonts for storefront rendering
- **Data Tables**: Ant Design ProTable with sorting, filtering, column pinning, CSV export
- **Charts**: Ant Design Charts (G2) for analytics, D3 for custom visualizations (funnel, heatmap)
- **Forms**: Ant Design Form with real-time validation, auto-save indicators
- **Notifications**: Toast for async operations, modal for destructive actions
- **Empty States**: Illustrated empty states with setup wizard CTAs
- **Loading**: Skeleton loaders for dashboards, spinner for transactions
- **Real-time**: WebSocket for live dashboard updates and order stream
- **Dark Mode**: Full dark mode support for merchant admin
- **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation, screen reader support

---

*Document Classification: Internal — Confidential*
*Last Updated: March 2026*
*Owner: Product Design — eCommerce Platform*
