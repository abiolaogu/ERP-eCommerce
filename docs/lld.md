# Low-Level Design -- eCommerce Platform

## 1. Introduction

This Low-Level Design (LLD) document provides detailed implementation specifications for each FusionCommerce microservice. It covers class diagrams, method signatures, data structures, algorithm details, and inter-component contracts at a level sufficient for development.

## 2. Package: @fusioncommerce/contracts

### 2.1 Module: packages/contracts/src/index.ts

**Event Topic Constants:**

```typescript
export const ORDER_CREATED_TOPIC = 'order.created';
export const INVENTORY_RESERVED_TOPIC = 'inventory.reserved';
export const INVENTORY_FAILED_TOPIC = 'inventory.insufficient';
export const GROUP_COMMERCE_CAMPAIGN_CREATED_TOPIC = 'group-commerce.campaign.created';
export const GROUP_COMMERCE_CAMPAIGN_JOINED_TOPIC = 'group-commerce.campaign.joined';
export const GROUP_COMMERCE_CAMPAIGN_SUCCESSFUL_TOPIC = 'group-commerce.campaign.successful';
export const PAYMENT_CREATED_TOPIC = 'payment.created';
export const PAYMENT_SUCCEEDED_TOPIC = 'payment.succeeded';
export const PAYMENT_FAILED_TOPIC = 'payment.failed';
export const SHIPPING_LABEL_CREATED_TOPIC = 'shipping.label.created';
```

**Type Definitions:**

```typescript
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY';

export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  total: number;
  items: Array<{ sku: string; quantity: number; price: number }>;
}

export interface InventoryStatusEvent {
  orderId: string;
  status: 'reserved' | 'insufficient';
  sku?: string;
  quantity?: number;
}

export interface GroupCommerceCampaign {
  id: string;
  productId: string;
  minParticipants: number;
  maxParticipants: number;
  actualParticipants: number;
  price: number;
  originalPrice: number;
  startTime: string;
  endTime: string;
  status: 'active' | 'successful' | 'failed' | 'expired';
}

export interface PaymentCreatedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: Currency;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface PaymentSucceededEvent {
  paymentId: string;
  orderId: string;
}

export interface PaymentFailedEvent {
  paymentId: string;
  orderId: string;
  reason: string;
}

export interface ShippingLabelCreatedEvent {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  labelUrl: string;
}
```

## 3. Package: @fusioncommerce/event-bus

### 3.1 Interface: EventBus

```typescript
export interface EventBus {
  publish<T>(topic: string, payload: T): Promise<void>;
  subscribe<T>(topic: string, handler: EventHandler<T>): Promise<void>;
  disconnect(): Promise<void>;
}

export type EventHandler<T> = (event: EventEnvelope<T>) => Promise<void> | void;

export interface EventEnvelope<T> {
  topic: string;
  payload: T;
  timestamp: number;
}
```

### 3.2 Class: KafkaEventBus

**Constructor:**
```typescript
constructor(options: KafkaEventBusOptions)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| clientId | string | 'fusioncommerce-service' | Kafka client identifier |
| brokers | string[] | required | Bootstrap server addresses |
| ssl | boolean | undefined | Enable SSL/TLS |
| sasl | any | undefined | SASL authentication config |
| logLevel | logLevel | ERROR | Kafka client log level |

**Internal State:**
- `kafka: Kafka` - KafkaJS client instance
- `producer: Producer` - Single shared producer
- `consumers: Map<string, Consumer>` - One consumer per subscribed topic

**Method: publish(topic, payload)**
1. Connect producer (idempotent)
2. Serialize payload to JSON
3. Create message with current timestamp
4. Send to specified topic

**Method: subscribe(topic, handler)**
1. Check if consumer already exists for topic (return early if so)
2. Create consumer with groupId `{topic}-consumer`
3. Connect and subscribe to topic
4. Run eachMessage handler that deserializes JSON and invokes handler with EventEnvelope

**Method: disconnect()**
1. Disconnect all consumers in parallel
2. Disconnect producer

### 3.3 Class: InMemoryEventBus

**Internal State:**
- `handlers: Map<string, Set<EventHandler<unknown>>>` - Topic to handlers mapping

**Method: publish(topic, payload)**
1. Get handler set for topic (return if none)
2. Create EventEnvelope with topic, payload, and Date.now() timestamp
3. Invoke all handlers in parallel via Promise.all

**Method: subscribe(topic, handler)**
1. Get or create handler set for topic
2. Add handler to set

### 3.4 Factory: createEventBusFromEnv

```typescript
export function createEventBusFromEnv(env: EnvironmentConfig): EventBus
```

Decision logic:
1. If `env.useInMemoryBus === 'true'` OR `!env.kafkaBrokers` --> return InMemoryEventBus
2. Split `env.kafkaBrokers` by comma, trim whitespace, filter empty
3. If no valid brokers after parsing --> return InMemoryEventBus
4. Return new KafkaEventBus with parsed brokers

## 4. Package: @fusioncommerce/database

### 4.1 Factory: createDatabase

```typescript
export function createDatabase(config: DatabaseConfig): Knex
```

Creates a Knex instance configured for PostgreSQL:
- Client: 'pg'
- Connection: config.connectionString
- Pool min: config.poolMin ?? 2
- Pool max: config.poolMax ?? 10

## 5. Service: Catalog (services/catalog)

### 5.1 Class Diagram

```
+---------------------------+
|      BuildCatalogApp      |
|  (Function)               |
|---------------------------|
| + buildApp(options):      |
|   FastifyInstance          |
+---------------------------+
            |
            | creates
            v
+---------------------------+     +---------------------------+
|    CatalogService         |     |   CatalogRepository      |
|---------------------------|     |   <<interface>>           |
| - repository              |     |---------------------------|
| - eventBus                |     | + create(product): Product|
|---------------------------|     | + all(): Product[]        |
| + create(request): Product|     +---------------------------+
| + list(): Product[]       |              ^
+---------------------------+              |
                                 +---------+----------+
                                 |                    |
                    +------------+--+    +------------+--------+
                    | InMemory      |    | (Planned)           |
                    | CatalogRepo   |    | PostgresCatalogRepo |
                    +---------------+    +---------------------+
```

### 5.2 CatalogService.create() Algorithm

```
Input: CreateProductRequest { sku, name, description?, price, currency, inventory }
Output: Product

1. Generate id = crypto.randomUUID()
2. Construct Product object:
   { id, sku, name, description, price, currency, inventory }
3. Call repository.create(product) -- persists to storage
4. Call eventBus.publish('product.created', product) -- emits event
5. Return product
```

### 5.3 Route Definitions

| Method | Path | Schema Validation | Handler |
|--------|------|-------------------|---------|
| GET | /health | None | Returns `{ status: 'ok' }` |
| POST | /products | Body: { sku: string, name: string, price: number>=0, currency: string(3), inventory: int>=0 } | service.create(body) -> 201 |
| GET | /products | None | service.list() -> 200 |

## 6. Service: Orders (services/orders)

### 6.1 Class Diagram

```
+---------------------------+
|      BuildApp             |
+---------------------------+
            |
            v
+---------------------------+     +---------------------------+
|    OrderService           |     |   OrderRepository         |
|---------------------------|     |   <<interface>>           |
| - repository              |     |---------------------------|
| - eventBus                |     | + save(order): Order      |
|---------------------------|     | + findById(id): Order|null|
| + create(req): Order      |     | + all(): Order[]          |
| + list(): Order[]         |     | + init(): void            |
+---------------------------+     +---------------------------+
                                           ^
                              +------------+------------+
                              |                         |
                 +------------+------+    +-------------+-------+
                 | InMemoryOrderRepo |    | PostgresOrderRepo   |
                 | (Map<string,Order>)|   | (Knex connection)   |
                 +-------------------+    +---------------------+
```

### 6.2 OrderService.create() Algorithm

```
Input: CreateOrderRequest { customerId, items: [{sku, quantity, price}], currency }
Output: Order

1. Validate: customerId truthy AND items.length > 0
   If invalid: throw Error('Invalid order request')
2. Calculate total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
3. Construct Order:
   { id: randomUUID(), customerId, items: [...], total, currency: currency || 'USD',
     status: 'created', createdAt: new Date().toISOString() }
4. Call repository.save(order)
5. Construct OrderCreatedEvent: { orderId: order.id, customerId, total, items }
6. Call eventBus.publish(ORDER_CREATED_TOPIC, event)
7. Return order
```

### 6.3 PostgresOrderRepository Implementation

**save(order):**
- INSERT INTO orders with column mapping (camelCase -> snake_case)
- ON CONFLICT (id) MERGE for upsert behavior
- items serialized as JSON.stringify

**findById(id):**
- SELECT * FROM orders WHERE id = ?
- Returns null if no row
- Maps row to Order via mapRowToOrder (snake_case -> camelCase, parse JSONB items)

**all():**
- SELECT * FROM orders
- Map all rows via mapRowToOrder

## 7. Service: Inventory (services/inventory)

### 7.1 InventoryService.handleOrderCreated() Algorithm

```
Input: EventEnvelope<OrderCreatedEvent>
Output: void (publishes events as side effects)

1. Initialize results: InventoryReservation[] = []
2. For each item in event.payload.items:
   a. Call repository.reserve(orderId, item.sku, item.quantity)
   b. Push result to results array
3. Find first result with status === 'insufficient'
4. If insufficient found:
   a. Construct InventoryStatusEvent: { orderId, status: 'insufficient', sku, quantity }
   b. Publish to INVENTORY_FAILED_TOPIC
5. Else (all reservations succeeded):
   a. Construct InventoryStatusEvent: { orderId, status: 'reserved' }
   b. Publish to INVENTORY_RESERVED_TOPIC
```

**Critical note**: If any single item has insufficient stock, the entire order fails. Items that were successfully reserved before the failure are NOT automatically released. This is a known limitation that should be addressed with a compensation mechanism.

### 7.2 PostgresInventoryRepository.reserve() Algorithm

```sql
UPDATE inventory
SET quantity = quantity - :requestedQuantity
WHERE sku = :sku AND quantity >= :requestedQuantity
```

The UPDATE returns affected row count. If count > 0, reservation succeeded. If count === 0, stock was insufficient. This SQL-level condition prevents race conditions between concurrent reservation attempts.

## 8. Service: Group Commerce (services/group-commerce)

### 8.1 GroupCommerceService.join() Algorithm

```
Input: campaignId: string, userId: string
Output: GroupCommerceCampaign

1. Retrieve campaign = findById(campaignId)
2. If !campaign: throw Error('Campaign not found')
3. If campaign.status !== 'active': throw Error('Campaign is not active')
4. If campaign.actualParticipants >= campaign.maxParticipants:
   throw Error('Campaign is full')
5. Update repository: actualParticipants = actualParticipants + 1
6. Publish 'group-commerce.campaign.joined' event:
   { campaign: updatedCampaign, userId }
7. If updatedCampaign.actualParticipants >= updatedCampaign.minParticipants:
   a. Update repository: status = 'successful'
   b. Publish 'group-commerce.campaign.successful' event
8. Return updatedCampaign
```

**Race condition note**: The current implementation does not use database-level locking for participant counting. In a high-concurrency scenario, two simultaneous join requests could both pass the maxParticipants check. The PostgreSQL implementation should use SELECT FOR UPDATE or an atomic increment with a WHERE condition.

## 9. Service Entry Point Pattern

All services follow the same bootstrap pattern in `src/index.ts`:

```typescript
// 1. Create event bus from environment
const eventBus = createEventBusFromEnv({ kafkaBrokers, useInMemoryBus });

// 2. Create database connection
const db = createDatabase({ connectionString: DATABASE_URL });

// 3. Create repository with database connection
const repository = new PostgresRepository(db);

// 4. Build Fastify application with injected dependencies
const app = buildApp({ eventBus, repository });

// 5. Start listening
app.listen({ port: PORT, host: '0.0.0.0' })
  .then(async () => {
    await repository.init();  // Create tables if not exist
    app.log.info(`Service listening on port ${PORT}`);
  });

// 6. Graceful shutdown handlers
process.on('SIGINT', async () => { await eventBus.disconnect(); await app.close(); process.exit(0); });
process.on('SIGTERM', async () => { await eventBus.disconnect(); await app.close(); process.exit(0); });
```

## 10. Docker Build Specification

Multi-stage Dockerfile (common pattern):

**Stage 1 - Builder:**
- Base: node:20-alpine
- Copy workspace root configs (package.json, tsconfig.base.json, jest.preset.cjs)
- Copy all packages/ directories
- Copy target service package.json
- Run npm install
- Copy target service source code
- Run npm run build for target workspace
- Prune dev dependencies

**Stage 2 - Runner:**
- Base: node:20-alpine
- Set NODE_ENV=production
- Copy node_modules from builder
- Copy compiled dist/ from builder
- Copy service package.json
- Expose service port
- CMD: node dist/index.js

**Image size optimization**: The two-stage approach keeps the production image minimal by excluding TypeScript source, test files, and dev dependencies.

## 11. Test Implementation Pattern

```typescript
describe('service name', () => {
  it('performs expected behavior', async () => {
    // 1. Create InMemoryEventBus
    const bus = new InMemoryEventBus();

    // 2. Optionally subscribe to capture published events
    const events: unknown[] = [];
    await bus.subscribe(TOPIC, async (event) => { events.push(event.payload); });

    // 3. Build app with in-memory bus (repository defaults to in-memory)
    const app = buildApp({ eventBus: bus });

    // 4. Use Fastify inject() for HTTP request simulation
    const response = await app.inject({ method: 'POST', url: '/resource', payload });

    // 5. Assert HTTP response
    expect(response.statusCode).toBe(201);

    // 6. Assert event publication
    expect(events).toHaveLength(1);
  });
});
```

## 12. Error Code Reference

| Error | Source | HTTP Code | Condition |
|-------|--------|-----------|-----------|
| Schema validation error | Fastify | 400 | Request body does not match JSON schema |
| Invalid order request | OrderService | 400 | Empty customerId or empty items array |
| Campaign not found | GroupCommerceService | 500 (unhandled) | Campaign ID does not exist |
| Campaign is not active | GroupCommerceService | 500 (unhandled) | Campaign status is not 'active' |
| Campaign is full | GroupCommerceService | 500 (unhandled) | actualParticipants >= maxParticipants |

**Note**: Group Commerce errors are thrown but not caught by the route handler, resulting in 500 errors. This should be fixed to return appropriate 4xx status codes.

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
