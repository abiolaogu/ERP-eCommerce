# Use Cases -- eCommerce Platform

## 1. Overview

This document catalogs all use cases for the FusionCommerce eCommerce Platform organized by actor and subsystem. Each use case includes preconditions, main flow, alternative flows, postconditions, and implementation status.

## 2. Actor Definitions

| Actor | Description |
|-------|-------------|
| Customer | End user browsing and purchasing products |
| Vendor | Marketplace seller managing products and orders |
| Platform Admin | System administrator managing the platform |
| Campaign Creator | User or vendor creating group buying campaigns |
| Campaign Participant | User joining a group buying campaign |
| System (Kafka) | Automated event-driven processes |
| n8n Workflow | Automated orchestration processes |

## 3. Catalog Use Cases

### UC-CAT-001: Create Product

| Field | Value |
|-------|-------|
| Actor | Vendor |
| Priority | P0 |
| Status | Implemented |

**Preconditions:**
- Vendor has API access to Catalog Service (port 3000)

**Main Flow:**
1. Vendor sends POST /products with { sku, name, description, price, currency, inventory }
2. System validates request against JSON schema
3. System generates UUID for product
4. System persists product to repository
5. System publishes product.created event to Kafka
6. System returns 201 with product data

**Alternative Flows:**
- 2a. Validation fails (missing required fields, negative price) -> 400 error
- 4a. Repository write fails -> 500 error

**Postconditions:**
- Product exists in catalog repository
- product.created event is available on Kafka topic

### UC-CAT-002: List All Products

| Field | Value |
|-------|-------|
| Actor | Customer, Vendor |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Actor sends GET /products
2. System retrieves all products from repository
3. System returns 200 with product array

### UC-CAT-003: Search Products by Category

| Field | Value |
|-------|-------|
| Actor | Customer |
| Priority | P1 |
| Status | Not Implemented |

**Main Flow:**
1. Customer sends GET /products?category=electronics&sort=price
2. System filters products by category
3. System sorts results by specified field
4. System returns paginated results

### UC-CAT-004: Upload Product Images

| Field | Value |
|-------|-------|
| Actor | Vendor |
| Priority | P1 |
| Status | Not Implemented |

**Main Flow:**
1. Vendor sends POST /products/:id/images with multipart form data
2. System uploads image to MinIO
3. System associates image URL with product
4. System returns 201 with image metadata

## 4. Order Use Cases

### UC-ORD-001: Place Order

| Field | Value |
|-------|-------|
| Actor | Customer |
| Priority | P0 |
| Status | Implemented |

**Preconditions:**
- Customer has a valid customer ID
- Products exist with available inventory

**Main Flow:**
1. Customer sends POST /orders with { customerId, items: [{sku, quantity, price}], currency }
2. System validates request (customerId present, items non-empty, schema valid)
3. System calculates total = sum(item.price * item.quantity)
4. System creates order with status='created'
5. System persists order to repository
6. System publishes order.created event to Kafka
7. System returns 201 with order data

**Alternative Flows:**
- 2a. Invalid request (empty customerId, no items) -> 400 error with message
- 2b. Schema validation fails (negative quantity, missing sku) -> 400 error
- 5a. PostgreSQL write fails -> 500 error

**Postconditions:**
- Order persisted with status 'created'
- order.created event published, triggering inventory reservation

### UC-ORD-002: List Orders

| Field | Value |
|-------|-------|
| Actor | Customer, Vendor, Admin |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Actor sends GET /orders
2. System retrieves all orders from repository
3. System returns 200 with order array

### UC-ORD-003: Cancel Order

| Field | Value |
|-------|-------|
| Actor | Customer |
| Priority | P1 |
| Status | Not Implemented |

**Main Flow:**
1. Customer sends POST /orders/:id/cancel
2. System validates order exists and is in cancellable state
3. System updates order status to 'cancelled'
4. System publishes order.cancelled event
5. n8n workflow releases inventory reservation
6. n8n workflow initiates refund if payment was processed

### UC-ORD-004: Track Order Status

| Field | Value |
|-------|-------|
| Actor | Customer |
| Priority | P1 |
| Status | Not Implemented |

**Main Flow:**
1. Customer sends GET /orders/:id
2. System retrieves order by ID
3. System returns order with current status and tracking info

## 5. Inventory Use Cases

### UC-INV-001: Configure Stock Level

| Field | Value |
|-------|-------|
| Actor | Vendor, Admin |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Actor sends PUT /inventory with { sku, quantity }
2. System validates request (sku present, quantity >= 0)
3. System sets stock level in repository (upsert)
4. System returns 204 No Content

### UC-INV-002: Automatic Inventory Reservation

| Field | Value |
|-------|-------|
| Actor | System (Kafka event) |
| Priority | P0 |
| Status | Implemented |

**Preconditions:**
- Inventory Service is subscribed to order.created topic
- Stock levels have been configured for ordered SKUs

**Main Flow:**
1. order.created event received from Kafka
2. System iterates over order items
3. For each item, system attempts to reserve quantity
4. All reservations succeed -> publish inventory.reserved event

**Alternative Flows:**
- 3a. Any item has insufficient stock:
  - Publish inventory.insufficient event with failed SKU details
  - Note: Previously reserved items in the same order are NOT released

### UC-INV-003: View Stock Levels

| Field | Value |
|-------|-------|
| Actor | Vendor, Admin |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Actor sends GET /inventory
2. System returns all stock levels as array of { sku, quantity }

## 6. Group Commerce Use Cases

### UC-GRP-001: Create Group Buying Campaign

| Field | Value |
|-------|-------|
| Actor | Campaign Creator (Vendor) |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Creator sends POST /campaigns with { productId, minParticipants, maxParticipants, price, originalPrice, startTime, endTime }
2. System validates all required fields and constraints
3. System creates campaign with status='active', actualParticipants=0
4. System persists campaign to repository
5. System publishes group-commerce.campaign.created event
6. System returns 201 with campaign data

### UC-GRP-002: Join Group Buying Campaign

| Field | Value |
|-------|-------|
| Actor | Campaign Participant |
| Priority | P0 |
| Status | Implemented |

**Preconditions:**
- Campaign exists and is active
- Campaign has not reached maxParticipants

**Main Flow:**
1. Participant sends POST /campaigns/:id/join with { userId }
2. System retrieves campaign by ID
3. System validates campaign is active and not full
4. System increments actualParticipants
5. System publishes group-commerce.campaign.joined event
6. System returns 200 with updated campaign

**Alternative Flows:**
- 2a. Campaign not found -> Error thrown (currently 500, should be 404)
- 3a. Campaign not active -> Error thrown
- 3b. Campaign full -> Error thrown

### UC-GRP-003: Campaign Reaches Minimum Participants

| Field | Value |
|-------|-------|
| Actor | System (triggered by join) |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. After participant joins, if actualParticipants >= minParticipants
2. System updates campaign status to 'successful'
3. System publishes group-commerce.campaign.successful event

### UC-GRP-004: View Campaign Details

| Field | Value |
|-------|-------|
| Actor | Customer |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Customer sends GET /campaigns/:id
2. System returns campaign details including participant count and status

### UC-GRP-005: List Active Campaigns

| Field | Value |
|-------|-------|
| Actor | Customer |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Customer sends GET /campaigns
2. System returns all campaigns

## 7. Payment Use Cases (Planned)

### UC-PAY-001: Process Payment

| Field | Value |
|-------|-------|
| Actor | System (n8n workflow) |
| Priority | P0 |
| Status | Not Implemented |

**Main Flow:**
1. n8n workflow calls POST /payments with { orderId, amount, currency }
2. System creates payment record with status='pending'
3. System publishes payment.created event
4. System calls Stripe API to create PaymentIntent
5. On success: update status='succeeded', publish payment.succeeded
6. On failure: update status='failed', publish payment.failed with reason

### UC-PAY-002: Handle Stripe Webhook

| Field | Value |
|-------|-------|
| Actor | Stripe (external system) |
| Priority | P0 |
| Status | Not Implemented |

**Main Flow:**
1. Stripe sends POST /payments/webhook with event payload
2. System verifies Stripe signature
3. System updates payment status based on event type
4. System publishes corresponding payment event

## 8. Shipping Use Cases (Planned)

### UC-SHP-001: Generate Shipping Label

| Field | Value |
|-------|-------|
| Actor | System (triggered by payment.succeeded event) |
| Priority | P0 |
| Status | Not Implemented |

**Main Flow:**
1. payment.succeeded event received
2. System retrieves order details
3. System determines optimal carrier
4. System calls carrier API to generate label
5. System stores label URL and tracking number
6. System publishes shipping.label.created event

## 9. Platform Administration Use Cases

### UC-ADM-001: Health Check

| Field | Value |
|-------|-------|
| Actor | Platform Admin, Load Balancer |
| Priority | P0 |
| Status | Implemented |

**Main Flow:**
1. Actor sends GET /health to any service
2. System returns { status: 'ok' } with 200 status

### UC-ADM-002: Configure n8n Workflows

| Field | Value |
|-------|-------|
| Actor | Platform Admin, Business Analyst |
| Priority | P1 |
| Status | Partially Implemented (n8n running, no workflows defined) |

**Main Flow:**
1. Admin accesses n8n UI at :5678
2. Admin authenticates with basic auth (admin/password)
3. Admin creates workflow with Kafka trigger nodes
4. Admin configures HTTP request nodes to call service APIs
5. Admin activates workflow

## 10. Use Case Summary Matrix

| ID | Name | Actor | Priority | Status |
|----|------|-------|----------|--------|
| UC-CAT-001 | Create Product | Vendor | P0 | Implemented |
| UC-CAT-002 | List Products | Customer | P0 | Implemented |
| UC-CAT-003 | Search Products | Customer | P1 | Not Implemented |
| UC-CAT-004 | Upload Images | Vendor | P1 | Not Implemented |
| UC-ORD-001 | Place Order | Customer | P0 | Implemented |
| UC-ORD-002 | List Orders | Customer | P0 | Implemented |
| UC-ORD-003 | Cancel Order | Customer | P1 | Not Implemented |
| UC-ORD-004 | Track Order | Customer | P1 | Not Implemented |
| UC-INV-001 | Configure Stock | Vendor | P0 | Implemented |
| UC-INV-002 | Auto-Reserve | System | P0 | Implemented |
| UC-INV-003 | View Stock | Vendor | P0 | Implemented |
| UC-GRP-001 | Create Campaign | Vendor | P0 | Implemented |
| UC-GRP-002 | Join Campaign | Customer | P0 | Implemented |
| UC-GRP-003 | Campaign Success | System | P0 | Implemented |
| UC-GRP-004 | View Campaign | Customer | P0 | Implemented |
| UC-GRP-005 | List Campaigns | Customer | P0 | Implemented |
| UC-PAY-001 | Process Payment | System | P0 | Not Implemented |
| UC-PAY-002 | Stripe Webhook | Stripe | P0 | Not Implemented |
| UC-SHP-001 | Generate Label | System | P0 | Not Implemented |
| UC-ADM-001 | Health Check | Admin | P0 | Implemented |
| UC-ADM-002 | Configure Workflows | Admin | P1 | Partial |

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
