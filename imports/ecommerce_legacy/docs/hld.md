# High-Level Design -- eCommerce Platform

## 1. Introduction

This High-Level Design (HLD) document describes the system-level architecture of the FusionCommerce eCommerce Platform. It covers the major components, their interactions, data flows, and deployment topology at a level appropriate for architecture review and capacity planning.

## 2. System Overview

FusionCommerce is a composable, event-driven commerce platform implemented as a TypeScript monorepo containing six microservices, three shared packages, and infrastructure configuration for Apache Kafka (Redpanda), n8n workflow engine, and PostgreSQL databases.

### 2.1 High-Level Component Diagram

```
+-----------------------------------------------------------------------+
|                     CLIENT LAYER (Planned)                            |
|  [Web Storefront]  [Mobile App]  [Social Commerce]  [Chat Commerce]  |
+-----------------------------------------------------------------------+
                              |  REST / HTTP
                              v
+-----------------------------------------------------------------------+
|                      API GATEWAY (Planned)                            |
|  [JWT Auth]  [Rate Limiting]  [Request Routing]  [CORS]              |
+-----------------------------------------------------------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
          v                   v                   v
+-------------------+ +-------------------+ +-------------------+
| CATALOG SERVICE   | | ORDERS SERVICE    | | INVENTORY SERVICE |
| Port: 3000        | | Port: 3001        | | Port: 3002        |
| - POST /products  | | - POST /orders    | | - PUT /inventory  |
| - GET /products   | | - GET /orders     | | - GET /inventory  |
| - GET /health     | | - GET /health     | | - GET /health     |
+--------+----------+ +--------+----------+ +--------+----------+
         |                     |                     |
         +---------------------+---------------------+
                               |
                        KAFKA / REDPANDA
                    (Event Bus - Port 9092)
                               |
         +---------------------+---------------------+
         |                     |                     |
+--------v----------+ +--------v----------+ +--------v----------+
| GROUP COMMERCE    | | PAYMENTS SERVICE  | | SHIPPING SERVICE  |
| Port: 3003        | | Port: 3004        | | Port: 3005        |
| - POST /campaigns | | - POST /payments  | | - POST /shipments |
| - GET /campaigns  | | - GET /payments   | | - GET /shipments  |
| - POST /:id/join  | | - POST /webhook   | | - GET /tracking   |
+-------------------+ +-------------------+ +-------------------+
                               |
                        KAFKA / REDPANDA
                               |
                    +----------v-----------+
                    |   n8n WORKFLOW ENGINE |
                    |   Port: 5678         |
                    +----------+-----------+
                               |
              +----------------+----------------+
              |                |                |
     +--------v-------+ +-----v-------+ +-----v--------+
     | FRAUD DETECTION| | NOTIFICATION| | ANALYTICS    |
     | (AI - Planned) | | (Planned)   | | (Druid -     |
     |                | |             | |  Planned)    |
     +----------------+ +-------------+ +--------------+
```

## 3. Component Descriptions

### 3.1 Catalog Service

**Purpose**: Manages the product information catalog including creation, retrieval, and event emission for downstream consumers.

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 20 + Fastify 4.x |
| Port | 3000 |
| Storage | In-memory (Map), PostgreSQL planned |
| Events Published | product.created |
| Events Consumed | None |
| Dependencies | @fusioncommerce/event-bus, @fusioncommerce/contracts |

### 3.2 Orders Service

**Purpose**: Processes customer orders, computes totals, persists order records, and triggers the order fulfillment event chain.

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 20 + Fastify 4.x |
| Port | 3001 |
| Storage | InMemory + PostgreSQL (via Knex) |
| Events Published | order.created |
| Events Consumed | None (reacts to payment.failed via n8n) |
| Dependencies | @fusioncommerce/event-bus, @fusioncommerce/contracts, @fusioncommerce/database |

### 3.3 Inventory Service

**Purpose**: Manages stock levels and automatically reserves inventory when orders are created. Provides stock configuration API.

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 20 + Fastify 4.x |
| Port | 3002 |
| Storage | InMemory + PostgreSQL (via Knex, optimistic locking) |
| Events Published | inventory.reserved, inventory.insufficient |
| Events Consumed | order.created |
| Dependencies | @fusioncommerce/event-bus, @fusioncommerce/contracts, @fusioncommerce/database |

### 3.4 Group Commerce Service

**Purpose**: Manages social group buying campaigns with participant tracking, threshold-based success triggers, and event-driven lifecycle management.

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 20 + Fastify 4.x |
| Port | 3003 |
| Storage | InMemory + PostgreSQL (via Knex) |
| Events Published | campaign.created, campaign.joined, campaign.successful |
| Events Consumed | None |
| Dependencies | @fusioncommerce/event-bus, @fusioncommerce/contracts, @fusioncommerce/database |

### 3.5 Payments Service (Planned)

**Purpose**: Processes payment transactions through Stripe, manages payment lifecycle states, and emits payment events.

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 20 + Fastify 4.x |
| Port | 3004 |
| Storage | PostgreSQL (via Knex) |
| Events Published | payment.created, payment.succeeded, payment.failed |
| Events Consumed | inventory.reserved (via n8n) |
| External Integration | Stripe API |

### 3.6 Shipping Service (Planned)

**Purpose**: Generates shipping labels, manages carrier integrations, and provides tracking information.

| Aspect | Detail |
|--------|--------|
| Runtime | Node.js 20 + Fastify 4.x |
| Port | 3005 |
| Storage | PostgreSQL (via Knex) |
| Events Published | shipping.label.created |
| Events Consumed | payment.succeeded |
| External Integration | Carrier APIs |

## 4. Data Flow Diagrams

### 4.1 Order Processing Flow

```
Customer                Orders       Kafka        Inventory      n8n
   |                   Service                    Service
   | POST /orders        |            |             |             |
   |-------------------->|            |             |             |
   |                     |            |             |             |
   |    201 Created      |            |             |             |
   |<--------------------|            |             |             |
   |                     |            |             |             |
   |                     | order.created            |             |
   |                     |----------->|             |             |
   |                     |            |             |             |
   |                     |            | order.created             |
   |                     |            |------------>|             |
   |                     |            |             |             |
   |                     |            | inventory.reserved        |
   |                     |            |<------------|             |
   |                     |            |             |             |
   |                     |            | inventory.reserved        |
   |                     |            |------------------------>  |
   |                     |            |             |             |
   |                     |            |             |  (triggers  |
   |                     |            |             |  payment)   |
```

### 4.2 Group Commerce Flow

```
Vendor             Group Commerce     Kafka         User
   |                  Service                        |
   | POST /campaigns    |              |             |
   |-------------------->|             |             |
   |   201 Created       |             |             |
   |<--------------------|             |             |
   |                     | campaign.created           |
   |                     |------------>|             |
   |                     |             |             |
   |                     |             |   POST /campaigns/:id/join
   |                     |<-------------------------------|
   |                     |             |             |
   |                     | campaign.joined            |
   |                     |------------>|             |
   |                     |             |             |
   |                     | [if min met]|             |
   |                     | campaign.successful        |
   |                     |------------>|             |
   |                     |   200 OK    |             |
   |                     |------------------------------>|
```

## 5. Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Language | TypeScript | 5.4+ | Application code |
| Runtime | Node.js | 20 LTS | Server runtime |
| HTTP | Fastify | 4.26+ | REST API framework |
| Event Streaming | Redpanda | Latest | Kafka-compatible event bus |
| Database | PostgreSQL | 15+ | Transactional persistence |
| Query Builder | Knex | 3.1+ | SQL abstraction |
| Workflow | n8n | 1.70.1 | Business process orchestration |
| Payment | Stripe | 20.0+ | Card processing |
| Testing | Jest | 29.7+ | Unit and integration tests |
| Container | Docker | Latest | Application packaging |
| CI | GitHub Actions | v3 | Build and test automation |

## 6. Network Topology

### 6.1 Development (Docker Compose)

```
Docker Network: fusioncommerce_default
  |
  +-- redpanda:9092 (internal), localhost:19092 (external)
  |   +-- Schema Registry: :18081
  |   +-- Pandaproxy: :18082
  |
  +-- catalog-service:3000 --> localhost:3000
  +-- orders-service:3001 --> localhost:3001
  +-- inventory-service:3002 --> localhost:3002
  +-- group-commerce-service:3003 --> localhost:3003
  +-- payments-service:3004 --> localhost:3004
  +-- shipping-service:3005 --> localhost:3005
  +-- n8n:5678 --> localhost:5678
```

### 6.2 Production (Kubernetes Target)

```
Ingress Controller (Cloudflare Tunnel / Nginx)
  |
  +-- /api/catalog/* --> catalog-service.fusioncommerce.svc:3000
  +-- /api/orders/*  --> orders-service.fusioncommerce.svc:3001
  +-- /api/inventory/* --> inventory-service.fusioncommerce.svc:3002
  +-- /api/campaigns/* --> group-commerce-service.fusioncommerce.svc:3003
  +-- /api/payments/* --> payments-service.fusioncommerce.svc:3004
  +-- /api/shipping/* --> shipping-service.fusioncommerce.svc:3005
  +-- /n8n/*         --> n8n.fusioncommerce.svc:5678 (admin only)

Internal Network:
  +-- redpanda.fusioncommerce-data.svc:9092
  +-- yugabytedb.fusioncommerce-data.svc:5433
  +-- minio.fusioncommerce-data.svc:9000
```

## 7. Capacity Estimation

### 7.1 Throughput Targets

| Metric | Target | Basis |
|--------|--------|-------|
| Orders per second | 500 | Peak flash sale scenario |
| Catalog reads per second | 5,000 | Product browsing |
| Kafka events per second | 10,000 | All topics combined |
| Concurrent websocket connections | 50,000 | Livestream commerce sessions |

### 7.2 Storage Estimation (Year 1)

| Data Type | Growth Rate | Year 1 Total |
|-----------|------------|--------------|
| Orders | 50K/day | 18M records (~50GB) |
| Products | 10K/month | 120K records (~2GB) |
| Inventory snapshots | 120K/day | 44M records (~20GB) |
| Kafka events | 1M/day | 365M events (~500GB retention) |
| Media assets | 1TB/month | 12TB (MinIO) |

### 7.3 Resource Requirements (Production)

| Service | CPU | Memory | Replicas |
|---------|-----|--------|----------|
| Catalog | 500m | 512Mi | 3 |
| Orders | 1000m | 1Gi | 3 |
| Inventory | 1000m | 1Gi | 3 |
| Group Commerce | 500m | 512Mi | 2 |
| Payments | 1000m | 1Gi | 3 |
| Shipping | 500m | 512Mi | 2 |
| Redpanda | 2000m | 4Gi | 3 |
| n8n | 500m | 1Gi | 1 |
| YugabyteDB | 4000m | 8Gi | 3 |

## 8. Integration Points

| Integration | Protocol | Direction | Authentication |
|------------|----------|-----------|----------------|
| Stripe API | HTTPS | Outbound | API Key (Secret Key) |
| Carrier APIs | HTTPS | Outbound | API Key |
| Redpanda Schema Registry | HTTP | Internal | None (network isolation) |
| n8n Kafka Trigger | TCP | Internal | None (network isolation) |
| PostgreSQL | TCP | Internal | Username/Password |

## 9. Cross-Cutting Concerns

### 9.1 Health Checks

Every service exposes `GET /health` returning `{ status: "ok" }`. These endpoints are used for:
- Docker Compose health checks
- Kubernetes liveness probes
- Load balancer health verification

### 9.2 Graceful Shutdown

All services implement SIGINT and SIGTERM handlers that:
1. Disconnect the Kafka event bus
2. Close the Fastify HTTP server
3. Exit the process

### 9.3 Logging

Fastify's built-in Pino logger is enabled (`{ logger: true }`) for structured JSON logging. Log levels are configurable via environment variables.

### 9.4 Configuration

All runtime configuration is provided through environment variables:
- `PORT`: HTTP server port
- `KAFKA_BROKERS`: Comma-separated Kafka bootstrap servers
- `USE_IN_MEMORY_BUS`: Set to 'true' for development mode
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string (for future caching)

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
