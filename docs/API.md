# ERP-eCommerce API

## Core Endpoints
- `GET /healthz`
- `GET /v1/capabilities`

## Discovered Endpoints
- `/healthz`
- `/v1/analytics`
- `/v1/checkout`
- `/v1/fulfillment`
- `/v1/loyalty`
- `/v1/search`
- `/v1/social-commerce`
- `/v1/storefront`
- `/v1/subscription-commerce`
- `/v1/theme`

## Permissions
- JWT from ERP-IAM required for business endpoints
- `X-Tenant-ID` required for tenant-scoped data
