# Architecture -- eCommerce Platform

## 1. Architecture Overview

FusionCommerce follows a layered, event-driven microservices architecture organized into six tiers. The platform is designed as a composable commerce backbone where each service operates independently, communicates through Apache Kafka event streams, and exposes RESTful HTTP APIs via Fastify. The architecture enables multi-vendor marketplace operations, social commerce innovations, and AI-driven decisioning while maintaining loose coupling between components.

## 2. Architecture Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| API-First | Every capability is exposed as an HTTP API before any UI is built | Fastify REST endpoints with JSON schema validation |
| Event-Driven | Business state changes propagate asynchronously through events | Kafka topics with typed contracts (@fusioncommerce/contracts) |
| Composable | Services can be deployed independently or combined | npm workspaces monorepo with independent Docker builds |
| Polyglot Persistence | Each service uses the optimal datastore for its workload | PostgreSQL for transactions, ScyllaDB/Aerospike for low-latency, MinIO for objects |
| Multi-Tenant | Single deployment serves multiple isolated business tenants | tenant_id column partitioning with row-level isolation |
| Infrastructure Agnostic | Platform runs on any container orchestrator | Docker images, Kubernetes-ready, no cloud-specific dependencies |

## 3. System Context Diagram

```
+------------------+     +------------------+     +------------------+
| Web Storefronts  |     | Mobile Apps      |     | Social Commerce  |
| (Next.js / Vue)  |     | (React Native)   |     | (WhatsApp/TikTok)|
+--------+---------+     +--------+---------+     +--------+---------+
         |                         |                        |
         +-------------------------+------------------------+
                                   |
                          +--------v---------+
                          |   API Gateway    |
                          |  (Rate Limiting) |
                          +--------+---------+
                                   |
         +------------+------------+------------+------------+
         |            |            |            |            |
+--------v---+ +------v-----+ +---v--------+ +v-----------+ +v-----------+
| Catalog    | | Orders     | | Inventory  | | Group      | | Payments   |
| Service    | | Service    | | Service    | | Commerce   | | Service    |
| :3000      | | :3001      | | :3002      | | :3003      | | :3004      |
+-----+------+ +-----+------+ +-----+------+ +-----+------+ +-----+------+
      |              |              |              |              |
      +--------------+--------------+--------------+--------------+
                                   |
                    +--------------v--------------+
                    |     Apache Kafka / Redpanda |
                    |     (Event Bus)             |
                    +--------------+--------------+
                                   |
                    +--------------v--------------+
                    |     n8n Workflow Engine     |
                    |     (Orchestration)         |
                    +-----------------------------+
```

## 4. Layered Architecture

### Layer 1: Headless Presentation

Consumer-facing experiences are decoupled from backend services. Any frontend framework can consume the FusionCommerce APIs. Documented presentation options include:

- Web and Mobile Storefronts (Next.js, Vue Storefront)
- Social and Content Commerce embeds (TikTok/Douyin, Instagram)
- Conversational Commerce (WhatsApp, Messenger chatbots)
- Immersive Commerce (AR/VR shopping experiences)
- In-Store Digital (kiosks, scan-and-go, Freshippo-style O2O)

**Current status**: No frontend implementations exist. The platform is API-only.

### Layer 2: Commerce Core Microservices

Each microservice encapsulates a bounded context, exposes Fastify HTTP endpoints, and communicates through Kafka events.

| Service | Bounded Context | Port | Framework | Events |
|---------|----------------|------|-----------|--------|
| Catalog | Product Information Management | 3000 | Fastify 4.x | Publishes: product.created |
| Orders | Order Management System | 3001 | Fastify 4.x | Publishes: order.created |
| Inventory | Stock Management | 3002 | Fastify 4.x | Subscribes: order.created; Publishes: inventory.reserved, inventory.insufficient |
| Group Commerce | Social Group Buying | 3003 | Fastify 4.x | Publishes: campaign.created, campaign.joined, campaign.successful |
| Payments | Payment Processing | 3004 | Fastify 4.x | Planned: payment.created, payment.succeeded, payment.failed |
| Shipping | Fulfillment | 3005 | Fastify 4.x | Planned: shipping.label.created |

**Planned services** (not yet implemented): Livestream Commerce, Community/UGC, Wallet/Loyalty, Hyperlocal Commerce, Customer-as-Creator.

### Layer 3: Eventing and Workflow Orchestration

**Apache Kafka (Redpanda)** serves as the central nervous system. Every domain event is published to a dedicated topic with a typed payload defined in the @fusioncommerce/contracts package.

Event bus implementation from `packages/event-bus/src/index.ts`:
- `KafkaEventBus`: Production implementation using kafkajs with configurable brokers, SSL, and SASL
- `InMemoryEventBus`: Development/testing implementation for local and CI environments
- `createEventBusFromEnv()`: Factory function that reads `KAFKA_BROKERS` and `USE_IN_MEMORY_BUS` environment variables

**n8n** (v1.70.1) consumes Kafka topics to orchestrate multi-step business workflows. Example workflows (documented, not yet implemented):
- Order fraud scoring before payment processing
- Inventory reservation with automatic retry
- Customer notification chains (email, SMS, push)
- Group commerce campaign completion triggers

### Layer 4: Intelligence and Data

**Planned components** (not yet deployed):
- Apache Druid: Real-time OLAP analytics consuming Kafka streams
- AI Recommendation Engine: Personalized product suggestions
- Dynamic Pricing Service: Demand-based price adjustment
- Fraud Detection Service: ML-based order risk scoring
- Marketing Attribution: Multi-touch attribution modeling

### Layer 5: State and Storage

**Current implementation**:
- PostgreSQL via Knex query builder (connection pooling: min 2, max 10)
- In-memory repositories for development and testing

**Documented target state**:
- YugabyteDB: Strongly consistent transactional data (orders, customers, financial records)
- ScyllaDB or Aerospike: Ultra-low-latency data (sessions, group-deal counters, wallet balances)
- MinIO: S3-compatible object storage (product media, livestream archives, UGC)

### Layer 6: Infrastructure and Operations

**Current implementation**:
- Docker Compose with Redpanda, six service containers, and n8n
- GitHub Actions CI pipeline with build, test, and security audit
- Multi-stage Dockerfiles producing minimal production images on Node.js 20 Alpine

**Documented target state**:
- Kubernetes via Rancher with autoscaling and service mesh
- GitLab CI for build/test, ArgoCD for continuous deployment
- Cloudflare and Voxility for global edge access and DDoS protection
- OpenStack private cloud or public cloud hyperscaler deployment

## 5. Communication Patterns

### 5.1 Synchronous Communication

All client-facing requests use synchronous HTTP/REST:

```
POST /products     --> Catalog Service (creates product, returns 201)
POST /orders       --> Orders Service (creates order, returns 201)
PUT  /inventory    --> Inventory Service (sets stock level, returns 204)
POST /campaigns    --> Group Commerce Service (creates campaign, returns 201)
POST /campaigns/:id/join --> Group Commerce Service (joins campaign, returns 200)
GET  /health       --> All services (returns { status: "ok" })
```

### 5.2 Asynchronous Communication

Service-to-service communication is exclusively event-driven through Kafka:

```
order.created          --> Consumed by Inventory Service, n8n
inventory.reserved     --> Consumed by n8n (triggers payment)
inventory.insufficient --> Consumed by n8n (notifies customer, cancels order)
product.created        --> Consumed by analytics, personalization
payment.succeeded      --> Consumed by Shipping Service, n8n
payment.failed         --> Consumed by Orders Service (marks order failed)
shipping.label.created --> Consumed by n8n (sends tracking notification)
```

### 5.3 Event Envelope Structure

Every event published through the EventBus is wrapped in an envelope:

```typescript
interface EventEnvelope<T> {
  topic: string;
  payload: T;
  timestamp: number;
}
```

## 6. Data Architecture

### 6.1 Database Per Service

Each service owns its database schema and is the sole writer to its tables. Cross-service data access happens exclusively through events or API calls.

| Service | Tables | Key Columns |
|---------|--------|-------------|
| Orders | orders | id, customer_id, items (JSONB), total, currency, status, tenant_id, organization_id |
| Inventory | inventory | product_id, quantity, version, tenant_id |
| Group Commerce | group_commerce_campaigns | id, product_id, min/max/actual_participants, price, original_price, start/end_time, status |

### 6.2 Migration Strategy

Database migrations are managed by Knex and stored in each service's `migrations/` directory. Migration naming convention: `YYYYMMDDHHMMSS_description.ts`. Multi-tenancy support was added in a second migration pass that adds `tenant_id` columns and composite indices.

## 7. Deployment Architecture

### 7.1 Docker Compose (Development)

```yaml
Services:
  redpanda        --> Kafka-compatible streaming (ports: 9092, 19092, 18081, 18082)
  catalog-service --> :3000 (depends on redpanda)
  orders-service  --> :3001 (depends on redpanda)
  inventory-service --> :3002 (depends on redpanda)
  group-commerce-service --> :3003 (depends on redpanda)
  payments-service --> :3004 (depends on redpanda)
  shipping-service --> :3005 (depends on redpanda)
  n8n             --> :5678 (depends on redpanda)
```

### 7.2 Production Target

```
Kubernetes Cluster (Rancher-managed)
  |-- Namespace: fusioncommerce-prod
  |   |-- Deployment: catalog-service (replicas: 3)
  |   |-- Deployment: orders-service (replicas: 3)
  |   |-- Deployment: inventory-service (replicas: 3)
  |   |-- Deployment: group-commerce-service (replicas: 2)
  |   |-- Deployment: payments-service (replicas: 3)
  |   |-- Deployment: shipping-service (replicas: 2)
  |   |-- StatefulSet: redpanda (replicas: 3)
  |   |-- Deployment: n8n (replicas: 1)
  |-- Namespace: fusioncommerce-data
  |   |-- StatefulSet: yugabytedb (replicas: 3)
  |   |-- StatefulSet: scylladb (replicas: 3)
  |   |-- Deployment: minio (replicas: 4)
  |-- Namespace: fusioncommerce-analytics
  |   |-- StatefulSet: druid (historical, broker, coordinator)
  |-- Namespace: fusioncommerce-observability
      |-- Deployment: prometheus
      |-- Deployment: grafana
      |-- Deployment: jaeger
```

## 8. Security Architecture

### 8.1 Current State
- n8n uses basic auth (admin/password) -- must be changed for production
- No authentication on microservice endpoints
- npm audit runs in CI at high severity level

### 8.2 Target State
- API Gateway with JWT validation at the edge
- Service-to-service mTLS via service mesh (Istio/Linkerd)
- Secret management via HashiCorp Vault or Kubernetes Secrets
- Network policies restricting inter-namespace traffic
- Redpanda ACLs for topic-level authorization

## 9. Scalability Strategy

| Component | Scaling Mechanism | Trigger |
|-----------|-------------------|---------|
| Microservices | Horizontal Pod Autoscaler | CPU > 70%, Request queue depth |
| Kafka/Redpanda | Partition rebalancing | Consumer lag > threshold |
| PostgreSQL/YugabyteDB | Read replicas, connection pool scaling | Query latency > 100ms |
| ScyllaDB | Node addition with auto-sharding | Storage > 70% capacity |
| MinIO | Erasure-coded node expansion | Storage utilization > 80% |

## 10. Disaster Recovery

| Strategy | RPO | RTO | Implementation |
|----------|-----|-----|----------------|
| Database replication | 0 (synchronous) | 5 minutes | YugabyteDB synchronous replication |
| Event replay | 0 (Kafka retention) | 10 minutes | Kafka topic retention = 7 days |
| Service failover | N/A | 30 seconds | Kubernetes liveness/readiness probes + rolling restart |
| Cross-region DR | 1 minute | 15 minutes | YugabyteDB geo-replication, Kafka MirrorMaker |

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
