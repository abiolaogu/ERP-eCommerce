# Workflows -- eCommerce Platform

## 1. Overview

FusionCommerce uses a hybrid workflow architecture combining event choreography (services reacting to Kafka events independently) with centralized orchestration (n8n coordinating multi-step business processes). This document details every workflow in the platform, both implemented and planned.

## 2. Implemented Workflows

### 2.1 Product Creation Workflow

**Trigger**: HTTP POST /products on Catalog Service
**Type**: Synchronous request + async event emission

```
Step 1: Client sends POST /products with body:
        { sku, name, description, price, currency, inventory }
Step 2: Fastify validates request against JSON schema
        - sku: required string
        - name: required string
        - price: required number >= 0
        - currency: required string (3 chars)
        - inventory: required integer >= 0
Step 3: CatalogService.create() generates UUID via crypto.randomUUID()
Step 4: Product persisted to CatalogRepository (InMemory map)
Step 5: Event published to 'product.created' Kafka topic with full Product payload
Step 6: HTTP 201 response returned to client with created product
```

**Event payload** (product.created):
```json
{
  "id": "uuid",
  "sku": "SKU-001",
  "name": "Product Name",
  "description": "Description",
  "price": 29.99,
  "currency": "USD",
  "inventory": 100
}
```

### 2.2 Order Creation Workflow

**Trigger**: HTTP POST /orders on Orders Service
**Type**: Synchronous request + async event emission

```
Step 1: Client sends POST /orders with body:
        { customerId, items: [{ sku, quantity, price }], currency }
Step 2: Fastify validates request against JSON schema
        - customerId: required string
        - items: required array, minItems: 1
        - items[].sku: required string
        - items[].quantity: required integer >= 1
        - items[].price: required number >= 0
Step 3: OrderService.create() validates customerId is not empty and items.length > 0
Step 4: Total calculated: sum(item.price * item.quantity) for all items
Step 5: Order object created with UUID, status='created', createdAt=now
Step 6: Order persisted to OrderRepository (InMemory or PostgreSQL)
Step 7: OrderCreatedEvent published to 'order.created' Kafka topic:
        { orderId, customerId, total, items: [{ sku, quantity, price }] }
Step 8: HTTP 201 response returned to client
```

**Error path**:
```
If customerId is empty or items is empty:
  -> Throws Error('Invalid order request')
  -> Caught by route handler
  -> HTTP 400 response: { message: "Invalid order request" }
```

### 2.3 Inventory Reservation Workflow

**Trigger**: order.created Kafka event consumed by Inventory Service
**Type**: Fully asynchronous, event-driven choreography

```
Step 1: Inventory Service subscribes to 'order.created' on Fastify onReady hook
Step 2: Event received with EventEnvelope<OrderCreatedEvent>
Step 3: InventoryService.handleOrderCreated() iterates over event.payload.items
Step 4: For each item:
        - repository.reserve(orderId, sku, quantity) is called
        - InMemory: checks map, decrements if available >= requested
        - Postgres: UPDATE inventory SET quantity = quantity - :qty
                    WHERE sku = :sku AND quantity >= :qty
        - Returns InventoryReservation { orderId, sku, quantity, status }
Step 5: If any reservation has status 'insufficient':
        -> Publish to 'inventory.insufficient' topic:
           { orderId, status: 'insufficient', sku, quantity }
Step 6: If all reservations succeed:
        -> Publish to 'inventory.reserved' topic:
           { orderId, status: 'reserved' }
```

**Concurrency handling**: The PostgreSQL implementation uses optimistic locking via SQL WHERE condition. Multiple concurrent reservations for the same SKU will serialize at the database level, preventing overselling.

### 2.4 Group Commerce Campaign Lifecycle

**Trigger**: HTTP POST /campaigns, POST /campaigns/:id/join
**Type**: Synchronous requests with async event emissions and state transitions

```
Campaign Creation:
  Step 1: POST /campaigns with body:
          { productId, minParticipants, maxParticipants, price, originalPrice, startTime, endTime }
  Step 2: GroupCommerceService.create() generates UUID, sets actualParticipants=0, status='active'
  Step 3: Campaign persisted to GroupCommerceRepository
  Step 4: 'group-commerce.campaign.created' event published
  Step 5: HTTP 201 response

Campaign Join:
  Step 1: POST /campaigns/:id/join with body: { userId }
  Step 2: GroupCommerceService.join() retrieves campaign by ID
  Step 3: Validation checks:
          - Campaign exists (else Error: 'Campaign not found')
          - Campaign status is 'active' (else Error: 'Campaign is not active')
          - actualParticipants < maxParticipants (else Error: 'Campaign is full')
  Step 4: Repository updates actualParticipants + 1
  Step 5: 'group-commerce.campaign.joined' event published:
          { campaign: updatedCampaign, userId }
  Step 6: If actualParticipants >= minParticipants:
          - Repository updates status to 'successful'
          - 'group-commerce.campaign.successful' event published
  Step 7: HTTP 200 response with updated campaign
```

## 3. Planned Workflows

### 3.1 End-to-End Order Fulfillment (n8n Orchestrated)

```
Trigger: order.created Kafka event

n8n Workflow Steps:
  1. Receive order.created event from Kafka
  2. Call AI Fraud Detection Service
     - Input: orderId, customerId, total, items
     - Output: riskScore (0-100), recommendation (approve/review/reject)
  3. Decision: riskScore evaluation
     - If riskScore > 80: reject order, publish order.rejected
     - If riskScore 50-80: flag for manual review, notify ops team
     - If riskScore < 50: proceed to next step
  4. Wait for inventory.reserved or inventory.insufficient event
     - Timeout: 30 seconds
     - On timeout: retry or escalate
  5. If inventory.reserved:
     - Call Payments Service: POST /payments
       { orderId, amount: total, currency }
     - Wait for payment.succeeded or payment.failed
  6. If payment.succeeded:
     - Call Shipping Service: POST /shipments
       { orderId }
     - Send customer confirmation email
     - Update loyalty points
  7. If payment.failed:
     - Release inventory reservation
     - Notify customer of payment failure
     - Publish order.failed event
  8. If inventory.insufficient:
     - Notify customer of stockout
     - Suggest alternative products (AI recommendation)
     - Publish order.cancelled event
```

### 3.2 Payment Processing Workflow

```
Trigger: HTTP POST /payments or n8n orchestration call

Step 1: Create payment record with status='pending'
Step 2: Publish 'payment.created' event
Step 3: Call Stripe API: stripe.paymentIntents.create()
        { amount, currency, metadata: { orderId } }
Step 4a: On Stripe success:
         - Update payment status to 'succeeded'
         - Publish 'payment.succeeded' event: { paymentId, orderId }
Step 4b: On Stripe failure:
         - Update payment status to 'failed'
         - Publish 'payment.failed' event: { paymentId, orderId, reason }
Step 5: Webhook handler for async Stripe confirmations
        - POST /payments/webhook
        - Verify Stripe signature
        - Update payment status based on event type
```

### 3.3 Shipping Label Generation Workflow

```
Trigger: payment.succeeded Kafka event

Step 1: Shipping Service receives payment.succeeded event
Step 2: Retrieve order details from Orders Service: GET /orders/:orderId
Step 3: Determine carrier based on order destination and weight
Step 4: Call carrier API to generate shipping label
Step 5: Store label URL in shipments table
Step 6: Publish 'shipping.label.created' event:
        { orderId, trackingNumber, carrier, labelUrl }
Step 7: n8n workflow sends tracking notification to customer
```

### 3.4 Group Commerce Completion Workflow

```
Trigger: group-commerce.campaign.successful Kafka event

n8n Workflow Steps:
  1. Receive campaign successful event
  2. Retrieve all participants for the campaign
  3. For each participant:
     a. Create order via Orders Service at discounted price
     b. Process payment via Payments Service
     c. Send confirmation notification
  4. Update campaign analytics in Druid
  5. Notify vendor of group order completion
```

### 3.5 Campaign Expiration Workflow

```
Trigger: Scheduled (cron-based n8n workflow, every 5 minutes)

Step 1: Query Group Commerce Service for active campaigns past endTime
Step 2: For each expired campaign:
        a. If actualParticipants >= minParticipants:
           - Mark as successful
           - Trigger completion workflow (3.4)
        b. If actualParticipants < minParticipants:
           - Mark as expired
           - Refund any pre-authorized payments
           - Notify participants of expiration
```

## 4. Workflow Event Flow Matrix

| Source Event | Downstream Service | Action | Output Event |
|-------------|-------------------|--------|-------------|
| product.created | Analytics/AI | Index for recommendations | None |
| order.created | Inventory Service | Reserve stock | inventory.reserved OR inventory.insufficient |
| order.created | n8n | Start fulfillment workflow | (orchestration calls) |
| inventory.reserved | n8n/Payments | Process payment | payment.created |
| inventory.insufficient | n8n/Orders | Cancel order | order.cancelled |
| payment.created | Stripe | Charge customer | payment.succeeded OR payment.failed |
| payment.succeeded | Shipping | Generate label | shipping.label.created |
| payment.failed | Orders/n8n | Cancel order | order.failed |
| shipping.label.created | n8n/Notification | Send tracking info | None |
| campaign.created | Analytics | Track campaign metrics | None |
| campaign.joined | Analytics | Update participant count | None |
| campaign.successful | n8n | Create group orders | order.created (multiple) |

## 5. n8n Workflow Configuration

### 5.1 Kafka Trigger Node Configuration

```json
{
  "nodeType": "n8n-nodes-base.kafkaTrigger",
  "parameters": {
    "topic": "order.created",
    "groupId": "n8n-order-workflow",
    "bootstrapServers": "redpanda:9092",
    "options": {
      "readFromBeginning": false,
      "jsonParseMessage": true
    }
  }
}
```

### 5.2 HTTP Request Node (Service Call)

```json
{
  "nodeType": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "http://payments-service:3004/payments",
    "body": {
      "orderId": "={{ $json.orderId }}",
      "amount": "={{ $json.total }}",
      "currency": "USD"
    }
  }
}
```

## 6. Error Handling in Workflows

### 6.1 Retry Strategy

| Event Type | Max Retries | Backoff | Dead Letter Topic |
|-----------|-------------|---------|-------------------|
| order.created | 3 | Exponential (1s, 2s, 4s) | order.created.dlq |
| payment processing | 5 | Exponential (2s, 4s, 8s, 16s, 32s) | payment.retry.dlq |
| inventory.reservation | 3 | Linear (1s) | inventory.reservation.dlq |
| shipping.label | 3 | Exponential (5s, 10s, 20s) | shipping.label.dlq |

### 6.2 Compensation Patterns

When a step in a multi-step workflow fails, compensation actions undo previous steps:

| Failed Step | Compensation Action |
|------------|-------------------|
| Payment fails after inventory reserved | Release inventory reservation |
| Shipping fails after payment succeeded | Refund payment, release inventory |
| Group order creation fails | Refund all participants, mark campaign as failed |

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
