# Technology Architecture — Sovereign eCommerce

## 1. System Architecture
```
┌──────────────────────────────────────────────────┐
│   Merchant Storefronts (Next.js / Custom / SDKs) │
└──────────────────────┬───────────────────────────┘
                       │ GraphQL + REST API
┌──────────────────────┴───────────────────────────┐
│  API Gateway (Kong)                               │
│  Rate limiting, auth, routing, versioning         │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────┐
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Catalog   │ │ Cart &    │ │ Order     │      │
│  │ Service   │ │ Checkout  │ │ Management│      │
│  │ (Go)      │ │ (Go)      │ │ (Go)      │      │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Payment   │ │ Shipping  │ │Subscription│     │
│  │ Service   │ │ Service   │ │ Engine    │      │
│  │ (Go)      │ │ (Go)      │ │ (Go)      │      │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ Channel   │ │ AI/ML     │ │ Analytics │      │
│  │ Hub       │ │ Service   │ │ Service   │      │
│  │ (Go)      │ │ (Python)  │ │ (Go+Py)   │      │
│  └───────────┘ └───────────┘ └───────────┘      │
│  ┌───────────┐ ┌───────────┐                     │
│  │ ERP Hub   │ │ Storefront│                     │
│  │ (Go)      │ │ Renderer  │                     │
│  │           │ │ (Node.js) │                     │
│  └───────────┘ └───────────┘                     │
│  PostgreSQL | Kafka | Redis | S3 | Elasticsearch │
└──────────────────────────────────────────────────┘
```

## 2. Core Services

### Catalog Service
- **Product model**: Products, variants, options, collections, custom attributes, tags
- **Search**: Elasticsearch with typo tolerance, synonym matching, faceted search, and NLP query understanding
- **Media**: S3-backed image and video storage with automatic CDN distribution, image optimization (WebP, AVIF), and lazy loading
- **Performance**: p99 catalog query < 50ms, supports 500K+ SKUs per merchant

### Cart & Checkout Service
- **Headless cart**: Persistent server-side cart with merge on authentication
- **Customizable checkout**: Multi-step or single-page, custom fields, address validation, upsell/cross-sell injection points
- **Payment orchestration**: Multi-PSP routing (Stripe, Adyen, PayPal, Afterpay, Klarna) with automatic failover
- **Tax calculation**: Real-time tax via Avalara/TaxJar with nexus management
- **Performance**: p99 checkout < 200ms, 99.99% payment success rate

### Order Management Service
- **Order lifecycle**: Created -> Confirmed -> Fulfilled -> Shipped -> Delivered -> Completed
- **Split fulfillment**: Automatic order splitting across warehouses based on inventory proximity
- **Returns & exchanges**: RMA generation, automated refunds, exchange workflows
- **Fraud detection**: ML-based fraud scoring using order signals (IP, device, shipping mismatch, velocity)

### Subscription Engine
- **Billing models**: Fixed recurring, usage-based, prepaid, pay-as-you-go
- **Subscriber management**: Skip, pause, swap products, change frequency, gift subscriptions
- **Dunning**: Smart retry logic (optimal retry timing based on decline reason), pre-dunning notifications
- **Churn prediction**: ML model trained on subscriber behavior (engagement drop, support tickets, payment failures) predicts churn 30 days in advance
- **Performance**: Processes 50K+ subscription renewals/hour

### Channel Hub
| Channel | Integration Type | Capabilities | Sync Frequency |
|---|---|---|---|
| Web (own storefront) | Native | Full commerce | Real-time |
| Amazon | MWS/SP-API | Listings, orders, FBA/MCF inventory | 15 minutes |
| Walmart | Walmart API | Listings, orders, inventory | 15 minutes |
| TikTok Shop | TikTok Commerce API | Products, orders, live shopping | 15 minutes |
| Instagram Shopping | Meta Commerce API | Product catalog, checkout | 30 minutes |
| Shopify POS | Shopify API | Inventory, orders | Real-time |
| Square POS | Square API | Inventory, orders | Real-time |
| Wholesale (B2B) | Native | Catalogs, pricing, net terms | Real-time |

### AI/ML Service
| Model | Purpose | Architecture | Performance |
|---|---|---|---|
| Product recommendations | Cross-sell, upsell, "frequently bought together" | Collaborative filtering + content-based hybrid | 15% AOV increase |
| Search ranking | Semantic search, personalized result ranking | BERT-based re-ranker fine-tuned on commerce queries | 30% search conversion improvement |
| Storefront generation | AI-generated page layouts from brand guidelines | GPT-4 + layout transformer model | 4-hour store creation |
| Content generation | Product descriptions, meta tags, email copy | Fine-tuned LLM on D2C product content | 80% time reduction |
| Churn prediction | Subscriber churn prediction | XGBoost ensemble on behavioral features | 85% AUC, 30-day lead time |
| Fraud detection | Transaction fraud scoring | Gradient boosting on order signals | 0.1% false positive rate |
| Dynamic pricing | Price optimization based on demand signals | Reinforcement learning (contextual bandits) | 8-12% revenue uplift |

### ERP Integration Hub
| ERP | Protocol | Sync | Entities |
|---|---|---|---|
| QuickBooks Online | REST API | Near-real-time (5 min) | Orders, inventory, invoices, customers |
| NetSuite | SuiteTalk REST | Near-real-time | Orders, inventory, financials, items |
| Xero | REST API | Near-real-time (5 min) | Orders, invoices, payments |
| ShipStation | REST API | Real-time (webhooks) | Shipments, tracking, rates |
| ShipBob | REST API | Near-real-time | Inventory, fulfillment, returns |

## 3. Infrastructure

| Component | Technology | Configuration |
|---|---|---|
| Compute | AWS EKS (Kubernetes) | 3 AZ, horizontal autoscaling, spot instances for non-critical workloads |
| Database | PostgreSQL 16 (RDS) | Multi-AZ, read replicas per region, connection pooling (PgBouncer) |
| Search | Elasticsearch 8 | 3-node cluster, auto-scaling, index-per-merchant for isolation |
| Cache | Redis 7 (ElastiCache) | Cart sessions, product catalog cache, rate limiting, real-time inventory counts |
| Streaming | Apache Kafka (MSK) | Event-driven order pipeline, inventory sync, channel updates |
| CDN | CloudFront + Fastly | Global edge caching for storefronts, images, and API responses |
| Object Storage | S3 | Product media, exports, backups, ML model artifacts |
| ML Training | SageMaker | Recommendation and churn model training (GPU instances) |
| Monitoring | Datadog | APM, infrastructure, logs, custom dashboards per merchant |
| CI/CD | GitHub Actions + ArgoCD | GitOps with automated testing, canary deployments |

### Performance Targets

| Metric | Target | Current |
|---|---|---|
| Storefront TTFB (global) | < 100ms | 85ms (US), 140ms (EU) |
| API p99 latency | < 150ms | 120ms |
| Checkout p99 latency | < 200ms | 175ms |
| Search p99 latency | < 100ms | 82ms |
| Uptime (SLA) | 99.99% | 99.97% (trailing 12 months) |
| Image loading (largest contentful paint) | < 1.5s | 1.2s |
| Concurrent checkouts | 10K+/minute | Tested to 15K/minute |

## 4. Multi-Tenancy

- **Database isolation**: `merchant_id` on every table with PostgreSQL Row-Level Security (RLS). No cross-merchant data access possible at the database layer.
- **Search isolation**: Per-merchant Elasticsearch indices for product search. No cross-merchant search contamination.
- **Cache isolation**: Redis key namespacing by `merchant_id`. Cache invalidation is merchant-scoped.
- **CDN isolation**: Per-merchant CDN cache keys. Purging one merchant's cache does not affect others.
- **Kafka isolation**: Merchant-scoped Kafka topics for order and inventory events.
- **ML model isolation**: Per-merchant recommendation models trained on merchant-specific purchase data.
- **Rate limiting**: Per-merchant API rate limits based on pricing tier.

## 5. Security

| Control | Implementation |
|---|---|
| Authentication | OAuth 2.0 / OIDC for merchant dashboard; API keys + HMAC for storefront API |
| Authorization | RBAC (Owner, Admin, Editor, Viewer) per merchant |
| PCI DSS | Level 1 compliance via Stripe/Adyen tokenization. No card data touches our servers. |
| Encryption | AES-256 at rest (RDS, S3, Elasticsearch), TLS 1.3 in transit |
| Network | VPC with private subnets, WAF (OWASP Top 10), DDoS protection (CloudFront Shield) |
| Secrets | AWS Secrets Manager with automatic rotation |
| Audit logging | All admin actions, API access, and data changes logged to immutable audit trail |
| Compliance | SOC 2 Type I (Type II in progress), GDPR readiness, CCPA compliant |
| Fraud | ML-based transaction fraud scoring, velocity checks, device fingerprinting |
| Bot protection | Rate limiting + CAPTCHA + behavioral analysis to prevent scraping and automated attacks |

## 6. Storefront Rendering

### Architecture Options (Merchant Choice)
| Option | Technology | Performance | Flexibility | Recommended For |
|---|---|---|---|---|
| **Managed Storefront** | Next.js (hosted by us) | Excellent (SSR/SSG) | High (AI builder + custom code) | 70% of merchants |
| **Headless API** | Any frontend framework | Depends on merchant | Maximum | Developer-led brands |
| **SDK** | React SDK, Vue SDK, Svelte SDK | Good | Medium | Brands with 1-2 developers |
| **Hydrogen Bridge** | Shopify Hydrogen compatibility | Good | Medium | Shopify migrations |

### AI Storefront Builder Technical Details
1. **Input**: Brand guidelines (colors, fonts, logo), product catalog, reference URLs
2. **Layout Generation**: Transformer model generates responsive page layouts (hero, collection grid, featured products, testimonials, newsletter)
3. **Copy Generation**: Fine-tuned LLM generates headlines, product descriptions, CTAs aligned to brand voice
4. **Image Optimization**: Automatic cropping, background removal, WebP/AVIF conversion
5. **Output**: Deployable Next.js storefront with Tailwind CSS, connected to merchant's commerce API
6. **Iteration**: Visual editor for post-generation customization, A/B testing of variants

## 7. Technology Stack

| Layer | Tech | Rationale |
|---|---|---|
| Backend | Go 1.22 | Performance, concurrency for high-throughput commerce |
| ML | Python (PyTorch, scikit-learn, Hugging Face) | ML ecosystem, LLM fine-tuning |
| Storefront | Next.js 14 (React 18, TypeScript) | SSR/SSG for commerce performance |
| Merchant Dashboard | React 18, TypeScript, Ant Design | Consistent admin experience |
| API | GraphQL (gqlgen) + REST (OpenAPI 3.1) | GraphQL for storefronts, REST for integrations |
| Database | PostgreSQL 16 | ACID, RLS, JSONB for flexible product attributes |
| Search | Elasticsearch 8 | Full-text search, facets, analytics |
| Streaming | Apache Kafka | Event-driven order and inventory pipeline |
| CDN | CloudFront + Fastly | Global storefront delivery |
| IaC | Terraform + Helm | Multi-region deployment |
| CI/CD | GitHub Actions + ArgoCD | GitOps with canary deployments |
| Payments | Stripe + Adyen (orchestrated) | Multi-PSP with automatic failover |

## 8. Scalability Architecture

### Horizontal Scaling Strategy
| Component | Scaling Mechanism | Scaling Trigger | Max Tested |
|---|---|---|---|
| API Gateway | Pod autoscaling | CPU > 60% or RPS > 5K/pod | 50K RPS |
| Cart/Checkout | Pod autoscaling | CPU > 50% (latency-sensitive) | 15K concurrent checkouts |
| Catalog Service | Read replica autoscaling | Query latency > 30ms | 1M products queried/sec |
| Order Management | Kafka consumer autoscaling | Consumer lag > 1K messages | 10K orders/minute |
| Search | Elasticsearch node scaling | Index size, query latency | 50M products indexed |
| CDN | Edge auto-scaling (managed) | Traffic patterns | Unlimited (CloudFront/Fastly) |

### Data Architecture
- **Hot storage**: PostgreSQL for active orders, carts, and recent data (< 90 days)
- **Warm storage**: PostgreSQL read replicas for analytics queries (90 days - 2 years)
- **Cold storage**: S3 Parquet files for historical data (> 2 years), queryable via DuckDB
- **Search index**: Elasticsearch for product catalog, real-time inventory counts
- **Cache layer**: Redis for session data, cart state, rate limiting, and frequently accessed catalog data
