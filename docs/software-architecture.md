# Software Architecture -- eCommerce Platform

## 1. Introduction

This document describes the software architecture of the FusionCommerce platform at the code level, covering module organization, class hierarchies, dependency management, design patterns, and coding conventions used across the TypeScript monorepo.

## 2. Repository Structure

```
fusioncommerce/
  package.json              # Root workspace configuration
  tsconfig.base.json        # Shared TypeScript compiler options
  jest.preset.cjs           # Shared Jest configuration
  docker-compose.yml        # Local development orchestration
  .github/workflows/ci.yml  # CI pipeline definition
  packages/
    contracts/              # @fusioncommerce/contracts - shared event types
      src/index.ts          # Topic constants and event payload interfaces
    event-bus/              # @fusioncommerce/event-bus - Kafka abstraction
      src/index.ts          # EventBus interface, KafkaEventBus, InMemoryEventBus
    database/               # @fusioncommerce/database - Knex connection factory
      src/index.ts          # createDatabase() factory
  services/
    catalog/                # @fusioncommerce/catalog-service
      src/
        index.ts            # Entry point with server bootstrap
        app.ts              # Fastify application builder
        catalog-service.ts  # Business logic
        catalog-repository.ts # Data access (InMemory)
        types.ts            # Domain types
    orders/                 # @fusioncommerce/orders-service
      src/
        index.ts            # Entry point
        app.ts              # Fastify application builder
        order-service.ts    # Business logic
        order-repository.ts # Data access (InMemory + Postgres)
        types.ts            # Domain types
      migrations/           # Knex database migrations
    inventory/              # @fusioncommerce/inventory-service
      src/
        index.ts            # Entry point
        app.ts              # Fastify application builder
        inventory-service.ts # Business logic + event handling
        inventory-repository.ts # Data access (InMemory + Postgres)
        types.ts            # Domain types
      migrations/           # Knex database migrations
    group-commerce/         # @fusioncommerce/group-commerce-service
      src/
        index.ts            # Entry point
        app.ts              # Fastify application builder
        group-commerce-service.ts # Business logic
        group-commerce-repository.ts # Data access (InMemory + Postgres)
        types.ts            # Domain types
      migrations/           # Knex database migrations
    payments/               # @fusioncommerce/payments-service (scaffolded)
    shipping/               # @fusioncommerce/shipping-service (scaffolded)
```

## 3. Module Dependency Graph

```
@fusioncommerce/contracts
  ^          ^          ^
  |          |          |
  |    @fusioncommerce/event-bus (depends on kafkajs)
  |          ^          ^
  |          |          |
  |    @fusioncommerce/database (depends on knex, pg)
  |          ^          ^
  |          |          |
  +----------+----------+---> Each service depends on contracts + event-bus + database
```

All services depend on:
- `@fusioncommerce/contracts` for event topic names and payload type definitions
- `@fusioncommerce/event-bus` for the EventBus abstraction
- `@fusioncommerce/database` for PostgreSQL connection factory via Knex

The dependency direction is strictly from services toward packages. Packages never depend on services. The contracts package has zero dependencies on other workspace packages.

## 4. Design Patterns

### 4.1 Repository Pattern

Every service separates data access from business logic through a repository interface:

```typescript
// Interface defines the contract
export interface OrderRepository {
  save(order: Order): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  all(): Promise<Order[]>;
  init(): Promise<void>;
}

// In-memory implementation for testing and local dev
export class InMemoryOrderRepository implements OrderRepository { ... }

// PostgreSQL implementation for production
export class PostgresOrderRepository implements OrderRepository { ... }
```

This pattern is consistent across all implemented services:
- `CatalogRepository` / `InMemoryCatalogRepository`
- `OrderRepository` / `InMemoryOrderRepository` / `PostgresOrderRepository`
- `InventoryRepository` / `InMemoryInventoryRepository` / `PostgresInventoryRepository`
- `GroupCommerceRepository` / `InMemoryGroupCommerceRepository` / `PostgresGroupCommerceRepository`

### 4.2 Service Layer Pattern

Business logic is encapsulated in service classes that depend on repositories and the event bus:

```typescript
export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly eventBus: EventBus
  ) {}

  async create(request: CreateOrderRequest): Promise<Order> {
    // Validate, compute total, persist, publish event
  }

  async list(): Promise<Order[]> {
    return this.repository.all();
  }
}
```

### 4.3 Application Builder Pattern

Each service uses a `buildApp()` function that creates a Fastify instance, wires up dependencies, and registers routes:

```typescript
export function buildApp({ eventBus, repository }: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: true });
  const repo = repository ?? new InMemoryRepository();
  const service = new ServiceClass(repo, eventBus);

  app.get('/health', async () => ({ status: 'ok' }));
  app.post('/resource', { schema: { ... } }, async (request, reply) => {
    const result = await service.create(request.body);
    return reply.code(201).send(result);
  });

  return app;
}
```

This pattern enables clean dependency injection for testing: tests call `buildApp()` with an InMemoryEventBus and no explicit repository (falling back to in-memory).

### 4.4 Factory Pattern

The event bus is created via a factory that reads environment configuration:

```typescript
export function createEventBusFromEnv(env: EnvironmentConfig): EventBus {
  if (env.useInMemoryBus === 'true' || !env.kafkaBrokers) {
    return new InMemoryEventBus();
  }
  return new KafkaEventBus({ brokers: env.kafkaBrokers.split(',') });
}
```

Similarly, database connections use a factory:

```typescript
export function createDatabase(config: DatabaseConfig): Knex {
  return knex({ client: 'pg', connection: config.connectionString, pool: { ... } });
}
```

### 4.5 Event-Driven Architecture

Services publish domain events after state mutations and subscribe to events from other services:

```typescript
// Publishing (Orders Service)
await this.eventBus.publish(ORDER_CREATED_TOPIC, event);

// Subscribing (Inventory Service)
app.addHook('onReady', async () => {
  await eventBus.subscribe<OrderCreatedEvent>(ORDER_CREATED_TOPIC, (event) =>
    service.handleOrderCreated(event)
  );
});
```

## 5. TypeScript Configuration

### 5.1 Base Configuration (tsconfig.base.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@fusioncommerce/*": ["packages/*/src"]
    }
  }
}
```

Key decisions:
- **ES2020 target**: Supports modern JavaScript features (optional chaining, nullish coalescing)
- **strict: true**: Full type safety enforcement
- **Path aliases**: `@fusioncommerce/*` maps to package source directories for development

### 5.2 Package Module Type

All packages declare `"type": "module"` in package.json but compile to CommonJS via tsconfig. The `.js` extension is used in TypeScript imports for ESM compatibility.

## 6. Testing Architecture

### 6.1 Test Framework

- Jest 29.x with ts-jest transformer
- Shared configuration via `jest.preset.cjs`
- Test files co-located with source: `*.spec.ts`

### 6.2 Test Strategy

All current tests use the Application Builder Pattern for integration-style testing:

```typescript
describe('orders service', () => {
  it('creates orders and publishes events', async () => {
    const bus = new InMemoryEventBus();
    const events: unknown[] = [];
    await bus.subscribe(ORDER_CREATED_TOPIC, async (event) => {
      events.push(event.payload);
    });

    const app = buildApp({ eventBus: bus });
    const response = await app.inject({ method: 'POST', url: '/orders', payload });
    expect(response.statusCode).toBe(201);
    expect(events).toHaveLength(1);
  });
});
```

This approach:
- Tests HTTP endpoint behavior through Fastify's `inject()` method (no network)
- Verifies event publication through InMemoryEventBus subscriptions
- Exercises the full request path: route -> service -> repository -> event bus

## 7. Error Handling Strategy

### 7.1 Input Validation

Fastify JSON Schema validation handles request-level validation before business logic:

```typescript
schema: {
  body: {
    type: 'object',
    required: ['customerId', 'items'],
    properties: {
      customerId: { type: 'string' },
      items: { type: 'array', minItems: 1, ... }
    }
  }
}
```

### 7.2 Business Logic Errors

Service classes throw standard Error objects for business rule violations:

```typescript
if (campaign.status !== 'active') {
  throw new Error('Campaign is not active');
}
```

Route handlers catch and translate to HTTP 400 responses:

```typescript
try {
  const order = await service.create(request.body);
  return reply.code(201).send(order);
} catch (error) {
  return reply.code(400).send({ message: (error as Error).message });
}
```

### 7.3 Process-Level Error Handling

Each service entry point handles startup failures and graceful shutdown:

```typescript
process.on('SIGINT', async () => {
  await eventBus.disconnect();
  await app.close();
  process.exit(0);
});
```

## 8. Build and Packaging

### 8.1 Build Pipeline

```
npm run lint    --> tsc --noEmit (type checking without emit)
npm run test    --> jest (run all test suites)
npm run build   --> tsc -p tsconfig.build.json (compile to dist/)
npm run ci      --> lint && test && build (single CI command)
```

### 8.2 Docker Build

Multi-stage Dockerfile (demonstrated in catalog service):

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package.json tsconfig.base.json jest.preset.cjs ./
COPY packages ./packages
COPY services/catalog/package.json ./services/catalog/
RUN npm install
COPY services/catalog ./services/catalog
RUN npm run build --workspace @fusioncommerce/catalog-service
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/services/catalog/dist ./dist
COPY services/catalog/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 8.3 CI Pipeline (GitHub Actions)

```yaml
Jobs:
  build-and-test:
    - checkout, setup node 20, npm ci
    - npm run build --workspaces
    - npm test --workspaces
    - npm audit --audit-level=high

  docker-build (depends on build-and-test):
    - Matrix: [catalog, orders, inventory, group-commerce, payments, shipping]
    - docker build -f services/$service/Dockerfile
```

## 9. Dependency Management

| Dependency | Version | Purpose |
|-----------|---------|---------|
| fastify | ^4.26.2 | HTTP server framework |
| kafkajs | ^2.2.4 | Apache Kafka client |
| knex | ^3.1.0 | SQL query builder |
| pg | ^8.11.3+ | PostgreSQL driver |
| pino | ^9.1.0 | Structured logging |
| stripe | ^20.0.0 | Payment processing (payments service) |
| typescript | ^5.4.5 | Language compiler |
| jest | ^29.7.0 | Test framework |
| ts-jest | ^29.2.5 | TypeScript Jest transformer |

## 10. Code Conventions

- All domain types are defined in `types.ts` within each service
- Repository interfaces are co-located with their implementations
- Event topic constants use UPPER_SNAKE_CASE (e.g., `ORDER_CREATED_TOPIC`)
- Service classes use constructor injection for dependencies
- UUID generation uses Node.js built-in `crypto.randomUUID()`
- All async operations return Promises
- Entity IDs are string UUIDs
- Monetary values are stored as numbers (not cents) with decimal(10,2) in PostgreSQL

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
