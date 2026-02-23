# Technical Writeup -- eCommerce Platform

## 1. Executive Technical Summary

FusionCommerce is a TypeScript monorepo implementing a composable, event-driven commerce platform. The current codebase delivers four production-ready microservices (Catalog, Orders, Inventory, Group Commerce) with two scaffolded services (Payments, Shipping), three shared packages (contracts, event-bus, database), and infrastructure configuration for Redpanda (Kafka), n8n, and Docker-based deployment. This writeup provides a technical deep-dive into the implementation decisions, patterns, trade-offs, and areas requiring attention.

## 2. Monorepo Architecture

### 2.1 Workspace Configuration

The project uses npm native workspaces (not Nx, Turborepo, or Lerna) for simplicity:

```json
{
  "workspaces": ["packages/*", "services/*"]
}
```

This allows any workspace to reference another using its package name (e.g., `@fusioncommerce/event-bus`). The `"type": "module"` declaration in each package.json indicates ES module intent, though the TypeScript compilation target is CommonJS (`"module": "commonjs"` in tsconfig.base.json).

**Trade-off analysis**: The ESM/CJS mismatch is managed through TypeScript's emit and `.js` extension imports. This works but creates friction when importing non-TypeScript ESM packages. A clean migration to full ESM would require changing the tsconfig module setting and ensuring all dependencies support ESM.

### 2.2 Dependency Resolution

Path aliases allow clean imports during development:
```json
"paths": { "@fusioncommerce/*": ["packages/*/src"] }
```

At runtime (post-compilation), npm workspace linking resolves `@fusioncommerce/*` to the installed package. The catalog service demonstrates a file-link pattern for the database package:
```json
"@fusioncommerce/database": "file:../../packages/database"
```

While other services use version-based references:
```json
"@fusioncommerce/event-bus": "1.0.0"
```

This inconsistency should be standardized to either all file-links or all workspace protocol references.

## 3. Event-Driven Architecture Analysis

### 3.1 Event Bus Abstraction

The `EventBus` interface provides an excellent abstraction that decouples services from the specific message broker:

```typescript
export interface EventBus {
  publish<T>(topic: string, payload: T): Promise<void>;
  subscribe<T>(topic: string, handler: EventHandler<T>): Promise<void>;
  disconnect(): Promise<void>;
}
```

The dual implementation (KafkaEventBus for production, InMemoryEventBus for testing) follows the Strategy pattern effectively. The factory function `createEventBusFromEnv()` encapsulates the selection logic.

### 3.2 Event Contract System

The contracts package defines a closed set of event topics and their TypeScript interfaces. This provides compile-time type safety for event payloads. However, several limitations exist:

1. **No runtime schema validation**: Events are serialized as JSON without schema validation. A malformed event will cause runtime errors in consumers.
2. **No schema registry integration**: Redpanda exposes a Schema Registry on port 18081, but no Avro or JSON Schema definitions are registered.
3. **No event versioning**: There is no version field in the EventEnvelope, making backward-compatible evolution difficult.
4. **No correlation ID**: Events lack a trace/correlation ID for distributed tracing across the event chain.

### 3.3 Consumer Group Strategy

Each topic subscription creates a consumer with groupId `{topic}-consumer`. This means:
- Multiple instances of the same service will share the topic's partitions (correct for scaling)
- Multiple different services subscribing to the same topic will each get their own consumer group and receive all messages (correct for fan-out)

However, n8n's Kafka trigger will create its own consumer group, which must be coordinated to avoid naming conflicts.

## 4. Data Layer Analysis

### 4.1 Repository Pattern Implementation

The repository pattern is well-executed with interface/implementation separation. The code demonstrates two levels of sophistication:

**Basic (Catalog)**: Only InMemory implementation exists. The repository interface is simple (create, all).

**Advanced (Orders, Inventory, Group Commerce)**: Both InMemory and PostgreSQL implementations exist with proper:
- Upsert via ON CONFLICT
- JSONB for flexible nested data
- Optimistic locking via SQL WHERE conditions
- camelCase/snake_case mapping between TypeScript and PostgreSQL

### 4.2 Migration Analysis

The migration system reveals a schema design tension. The initial migration for orders uses a flat schema:
```sql
CREATE TABLE orders (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  product_id VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  ...
);
```

But the runtime `PostgresOrderRepository` uses a JSONB schema:
```sql
CREATE TABLE orders (
  id VARCHAR PRIMARY KEY,
  customer_id VARCHAR NOT NULL,
  items JSONB NOT NULL,
  ...
);
```

This means the migration creates a table structure that the repository does not use. The repository's `init()` method creates a different table if the migration has not run. This dual-schema approach will cause issues if both mechanisms execute in the same database.

**Recommendation**: Consolidate to a single schema definition strategy, preferably migrations-first with the repository's `init()` removed.

### 4.3 Connection Pooling

The database package defaults to pool min=2, max=10. For services with high write throughput (Orders), this may need tuning. The Knex pool configuration does not include:
- `idleTimeoutMillis` for connection cleanup
- `createTimeoutMillis` for connection creation
- `acquireTimeoutMillis` for pool exhaustion handling

## 5. API Layer Analysis

### 5.1 Fastify Configuration

All services use `Fastify({ logger: true })` which enables Pino structured logging. The JSON schema validation on routes provides both documentation and runtime validation.

Missing Fastify plugins that should be added:
- `@fastify/cors` for cross-origin request handling
- `@fastify/helmet` for security headers
- `@fastify/rate-limit` for rate limiting
- `@fastify/swagger` for OpenAPI documentation generation

### 5.2 Error Handling Gaps

The Orders service properly catches and translates errors:
```typescript
try {
  const order = await service.create(request.body);
  return reply.code(201).send(order);
} catch (error) {
  return reply.code(400).send({ message: (error as Error).message });
}
```

The Group Commerce service does NOT catch errors in the join route:
```typescript
async (request, reply) => {
  const { id } = request.params;
  const { userId } = request.body;
  const campaign = await service.join(id, userId);
  return reply.code(200).send(campaign);
}
```

If `service.join()` throws (campaign not found, not active, full), Fastify returns a 500 with the full error stack. This should be wrapped in try/catch with appropriate 404/409 responses.

## 6. Testing Analysis

### 6.1 Test Coverage

| Component | Tests | Coverage Areas |
|-----------|-------|---------------|
| event-bus | 2 tests | Factory returns InMemoryEventBus, event delivery works |
| catalog | 1 test | Create and list products |
| orders | 1 test | Create order, verify event publication, verify total calculation |
| inventory | 2 tests | Successful reservation, insufficient stock |
| group-commerce | 2 tests | Create/list campaigns, join campaign |

### 6.2 Testing Gaps

- No negative test cases for schema validation failures
- No concurrent access tests for inventory reservation
- No integration tests with real Kafka/Redpanda
- No database-level tests with PostgreSQL
- No e2e tests across multiple services
- No performance/load tests
- Contract tests between services are absent

## 7. Security Analysis

### 7.1 Current Security Posture

**Critical vulnerabilities:**
1. All service endpoints are unauthenticated
2. No input sanitization beyond JSON schema validation
3. n8n uses hardcoded credentials (admin/password)
4. Database credentials in .env.example are plaintext
5. No HTTPS/TLS configuration for inter-service communication
6. No rate limiting on any endpoint

### 7.2 Recommended Security Improvements

1. Add JWT middleware to all Fastify services
2. Implement API key authentication for service-to-service calls
3. Add @fastify/helmet for security headers
4. Configure TLS for Redpanda connections
5. Implement Kubernetes NetworkPolicies for network isolation
6. Use external secret management (Vault, Kubernetes Secrets)
7. Add CORS configuration with allowlisted origins

## 8. Performance Considerations

### 8.1 Known Bottlenecks

1. **Kafka producer connect-per-publish**: The KafkaEventBus calls `producer.connect()` on every publish call. While kafkajs handles this idempotently, it adds overhead. The producer should connect once during initialization.

2. **In-memory repositories in Catalog**: The catalog service has no PostgreSQL repository implementation, meaning product data is lost on container restart.

3. **Sequential item reservation**: The inventory service processes order items sequentially in a for loop. For orders with many items, parallel reservation would improve latency.

4. **No caching layer**: REDIS_URL is configured in docker-compose but no Redis container or caching logic exists.

### 8.2 Scalability Readiness

The architecture is fundamentally scalable due to:
- Stateless services (state in databases and Kafka)
- Kafka consumer groups for parallel processing
- Docker-based deployment ready for Kubernetes HPA
- Connection pooling in database layer

However, horizontal scaling requires:
- Kafka topic partitioning strategy (currently default single partition)
- Session affinity for any stateful operations
- Distributed lock management for inventory reservation across instances

## 9. DevOps and CI/CD Analysis

### 9.1 CI Pipeline Strengths

- Matrix strategy for parallel Docker builds across all services
- Security audit (`npm audit --audit-level=high`) as a build step
- Node.js 20 LTS with npm caching

### 9.2 CI Pipeline Gaps

- No test coverage threshold enforcement
- No container image scanning (Trivy, Snyk)
- No semantic versioning or changelog generation
- No deployment automation (staging/production)
- No integration test job
- Docker images are built but not pushed to a registry

## 10. Recommendations Summary

| Priority | Recommendation | Effort |
|----------|---------------|--------|
| Critical | Implement payments and shipping services | 2 weeks |
| Critical | Add authentication middleware | 1 week |
| Critical | Resolve migration/repository schema conflicts | 3 days |
| High | Add PostgreSQL to docker-compose for local dev | 1 day |
| High | Add error handling to group-commerce routes | 1 day |
| High | Connect producer once in KafkaEventBus constructor | 1 hour |
| High | Implement CORS and security headers | 2 days |
| Medium | Add OpenAPI/Swagger documentation | 3 days |
| Medium | Implement Redis caching layer | 1 week |
| Medium | Create Helm charts for Kubernetes | 1 week |
| Medium | Add e2e test suite | 2 weeks |
| Low | Standardize workspace dependency references | 1 day |
| Low | Add event schema versioning | 1 week |

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
