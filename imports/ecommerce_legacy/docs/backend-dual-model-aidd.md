# Backend Dual-Model Support (AIDD)
> Date: 2026-02-20
> Scope: Backend APIs for single-merchant multitenant storefronts and multi-vendor marketplaces.

## 1. Goal
The backend now supports two frontend operating modes:
1. `single_merchant` (Shopify-style tenant storefront)
2. `marketplace` (Amazon-style multi-vendor marketplace)

## 2. Shared Context Contract
These context fields are now propagated through core domain events and service payloads:
- `tenantId`
- `merchantId`
- `storeId` (orders)
- `commerceModel` (`single_merchant` | `marketplace`)
- `salesChannel` (`storefront` | `marketplace` | `social` | `pos` | `b2b`)
- `vendorId` (item-level or flow-level where relevant)

## 3. Model Rules Enforced

### 3.1 Orders
- `single_merchant`:
  - cannot include mixed vendor line items
  - cannot use `salesChannel=marketplace`
- `marketplace`:
  - each line item must provide `vendorId`
  - must use `salesChannel=marketplace`
- Order responses include `fulfillmentGroups` grouped by vendor for downstream split workflows.

### 3.2 Catalog
- `marketplace` product creation requires `vendorId`.
- `single_merchant` products default vendor scope to merchant scope.
- Product listing supports model/channel filters for frontend route partitioning.

### 3.3 Inventory
- Inventory is now scoped by `tenantId + vendorId + sku`.
- Reservation consumes stock within the correct vendor scope, preventing cross-vendor leakage.

### 3.4 Payments
- Marketplace split settlement is supported via `settlementMode=split` and `allocations[]`.
- Allocation totals must match payment amount.
- Single-merchant mode blocks multi-vendor split allocation.

### 3.5 Shipping
- Marketplace label generation requires `vendorId`.
- Shipping label events now include commerce context.

## 4. AIDD Guardrail Alignment

### 4.1 Accessibility/Usability Support
- API contracts provide deterministic error messages for invalid model combinations.

### 4.2 Performance
- No cross-tenant scans required for filtered list operations (`tenantId`, `commerceModel`, `salesChannel`, `vendorId` filters).
- Added/maintained indexes for high-cardinality query paths.

### 4.3 Reliability
- Explicit model validation prevents data-shape ambiguity between frontend modes.
- Context propagation reduces downstream orchestration mismatch.

### 4.4 Observability
- Domain events now include model and tenant context needed for segmented telemetry and incident analysis.

### 4.5 Testability
- Added tests for both success and guardrail failure paths across orders, catalog, inventory, payments, and shipping.

## 5. Frontend Integration Notes
Use `commerceModel` and `salesChannel` explicitly in frontend API calls.

### 5.1 Single-Merchant Example (Orders)
```json
{
  "customerId": "cust-1",
  "tenantId": "tenant-shop-1",
  "merchantId": "merchant-shop-1",
  "commerceModel": "single_merchant",
  "salesChannel": "storefront",
  "items": [
    { "sku": "sku-1", "quantity": 1, "price": 49.99 }
  ]
}
```

### 5.2 Marketplace Example (Orders)
```json
{
  "customerId": "cust-2",
  "tenantId": "tenant-market-1",
  "commerceModel": "marketplace",
  "salesChannel": "marketplace",
  "items": [
    { "sku": "sku-a", "vendorId": "vendor-a", "quantity": 1, "price": 29.99 },
    { "sku": "sku-b", "vendorId": "vendor-b", "quantity": 2, "price": 10.00 }
  ]
}
```
