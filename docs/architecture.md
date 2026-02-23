# ERP-eCommerce Architecture

## C4 Context
- Module: `ERP-eCommerce`
- Mode: standalone_plus_suite
- Auth: ERP-IAM (OIDC/JWT)
- Entitlements: ERP-Platform

## Container View
```mermaid
flowchart TB
    U["Users"] --> G["Gateway / API"]
    S1["analytics-service"]
    S2["catalog"]
    S3["checkout-service"]
    S4["fulfillment-service"]
    S5["group-commerce"]
    S6["inventory"]
    S7["loyalty-service"]
    S8["orders"]
    S9["payments"]
    S10["search-service"]
    S11["shipping"]
    S12["social-commerce-service"]
    S13["storefront-service"]
    S14["subscription-commerce-service"]
    S15["theme-service"]
    G --> S1
    G --> S2
    G --> S3
    G --> S4
    G --> S5
    G --> S6
    G --> S7
    G --> S8
    G --> S9
    G --> S10
    G --> S11
    G --> S12
    G --> S13
    G --> S14
    G --> S15
    G --> DB["PostgreSQL"]
    G --> EV["Redpanda/Kafka"]
```

## Service Inventory
- `analytics-service`
- `catalog`
- `checkout-service`
- `fulfillment-service`
- `group-commerce`
- `inventory`
- `loyalty-service`
- `orders`
- `payments`
- `search-service`
- `shipping`
- `social-commerce-service`
- `storefront-service`
- `subscription-commerce-service`
- `theme-service`
