# README — eCommerce Platform
> Version: 1.0 | Last Updated: 2026-02-18 | Status: Draft
> Classification: Internal | Author: AIDD System

## 1. FusionCommerce

FusionCommerce is an API-first, event-driven, composable commerce platform designed to power multi-vendor marketplace experiences across digital, social, and in-person channels. Built as a TypeScript monorepo, the platform integrates global commerce innovation models -- including social group buying, livestream commerce, and AI-driven personalization -- into a unified microservices architecture orchestrated through Apache Kafka and n8n workflows.

## 2. Architecture Overview

```
+-----------------------------------------------------------------------+
|                         CLIENT LAYER (Planned)                        |
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
+-------------------+ +-------------------+ +-------------------+
          |                   |                   |
          +-------------------+-------------------+
                              |
                     KAFKA / REDPANDA (Port 9092)
                              |
          +-------------------+-------------------+
          |                   |                   |
+-------------------+ +-------------------+ +-------------------+
| GROUP COMMERCE    | | PAYMENTS SERVICE  | | SHIPPING SERVICE  |
| Port: 3003        | | Port: 3004        | | Port: 3005        |
+-------------------+ +-------------------+ +-------------------+
```

## 3. Services

| Service | Port | Status | Description |
|---------|------|--------|-------------|
| Catalog | 3000 | Implemented | Product information management (CRUD, events) |
| Orders | 3001 | Implemented | Order lifecycle management with PostgreSQL persistence |
| Inventory | 3002 | Implemented | Event-driven stock reservation and tracking |
| Group Commerce | 3003 | Implemented | Social group buying campaigns with participant management |
| Payments | 3004 | Scaffolded | Payment processing via Stripe (package only) |
| Shipping | 3005 | Scaffolded | Shipping label generation and tracking (package only) |

## 4. Shared Packages

| Package | Description |
|---------|-------------|
| @fusioncommerce/contracts | Event topic constants and typed payload interfaces |
| @fusioncommerce/event-bus | Kafka abstraction with KafkaEventBus and InMemoryEventBus |
| @fusioncommerce/database | Knex-based PostgreSQL connection factory with pool configuration |

## 5. Technology Stack

| Category | Technology |
|----------|-----------|
| Language | TypeScript 5.x on Node.js 18 LTS |
| HTTP Framework | Fastify 4.x |
| Database | PostgreSQL 15+ via Knex.js query builder |
| Event Streaming | Apache Kafka (Redpanda) via KafkaJS |
| Workflow Engine | n8n 1.70.x |
| Testing | Jest 29.x |
| Containerization | Docker with Docker Compose |
| CI/CD | GitHub Actions |

## 6. Getting Started

### 6.1 Prerequisites
- Node.js 18+ and npm 9+
- Docker Desktop 4.x with 8 GB+ RAM allocated
- Git

### 6.2 Quick Start
```bash
# Clone the repository
git clone https://github.com/fusioncommerce/fusioncommerce.git
cd fusioncommerce

# Install dependencies
npm install

# Start infrastructure (Redpanda, PostgreSQL, n8n)
docker-compose up -d

# Run database migrations
cd services/orders && npx knex migrate:latest && cd ../..
cd services/inventory && npx knex migrate:latest && cd ../..
cd services/group-commerce && npx knex migrate:latest && cd ../..

# Start services in development mode
cd services/catalog && npm run dev &
cd services/orders && npm run dev &
cd services/inventory && npm run dev &
cd services/group-commerce && npm run dev &
```

### 6.3 Verify Installation
```bash
curl http://localhost:3000/health  # Catalog
curl http://localhost:3001/health  # Orders
curl http://localhost:3002/health  # Inventory
curl http://localhost:3003/health  # Group Commerce
```

## 7. Repository Structure

```
fusioncommerce/
  package.json              # Root workspace configuration
  tsconfig.base.json        # Shared TypeScript compiler options
  jest.preset.cjs           # Shared Jest configuration
  docker-compose.yml        # Local development orchestration
  .github/workflows/ci.yml  # CI pipeline definition
  packages/
    contracts/              # @fusioncommerce/contracts
    event-bus/              # @fusioncommerce/event-bus
    database/               # @fusioncommerce/database
  services/
    catalog/                # Catalog Service (port 3000)
    orders/                 # Orders Service (port 3001)
    inventory/              # Inventory Service (port 3002)
    group-commerce/         # Group Commerce Service (port 3003)
    payments/               # Payments Service (port 3004) - scaffolded
    shipping/               # Shipping Service (port 3005) - scaffolded
  docs/                     # Project documentation
```

## 8. API Quick Reference

### Create a Product
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"SKU-001","name":"Widget","description":"A fine widget","price":29.99,"currency":"USD","inventory":100}'
```

### List Products
```bash
curl http://localhost:3000/products
```

### Create an Order
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"CUST-001","items":[{"sku":"SKU-001","quantity":2,"price":29.99}],"currency":"USD"}'
```

### List Orders
```bash
curl http://localhost:3001/orders
```

### Create a Group Buying Campaign
```bash
curl -X POST http://localhost:3003/campaigns \
  -H "Content-Type: application/json" \
  -d '{"productId":"PROD-001","minParticipants":10,"maxParticipants":50,"discountPercentage":20,"expiresAt":"2026-03-01T00:00:00Z"}'
```

### Join a Campaign
```bash
curl -X POST http://localhost:3003/campaigns/<campaign-id>/join \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER-001"}'
```

## 9. Event Flow

The platform uses event-driven communication. Key event chains:

```
Order Created Flow:
  POST /orders -> order.created -> Inventory Service
    -> inventory.reserved -> Payments Service
    -> payment.succeeded -> Shipping Service
    -> shipping.label.created

Group Buying Flow:
  POST /campaigns -> group-commerce.campaign.created
  POST /campaigns/:id/join -> group-commerce.campaign.joined
  (min reached) -> group-commerce.campaign.successful
```

## 10. Development

### Running Tests
```bash
npm test                        # All tests
cd services/catalog && npm test  # Single service
npm test -- --coverage           # With coverage report
```

### Building
```bash
npm run build                   # Build all packages and services
```

### Linting
```bash
npm run lint                    # ESLint across all workspaces
```

### Docker Build
```bash
docker-compose build            # Build all service images
```

## 11. Infrastructure Access

| Component | URL | Purpose |
|-----------|-----|---------|
| Redpanda Console | http://localhost:8080 | Kafka topic monitoring |
| n8n Workflow Engine | http://localhost:5678 | Workflow automation |
| PostgreSQL | localhost:5432 | Database access |

## 12. Documentation

| Document | Description |
|----------|-------------|
| [Architecture](architecture.md) | System architecture and design principles |
| [Software Architecture](software-architecture.md) | Code-level module organization |
| [Enterprise Architecture](enterprise-architecture.md) | TOGAF-aligned enterprise context |
| [High-Level Design](hld.md) | System-level component design |
| [Low-Level Design](lld.md) | Detailed implementation specifications |
| [PRD](prd.md) | Product requirements document |
| [BRD](brd.md) | Business requirements document |
| [Database Schema](database-schema.md) | Table definitions and relationships |
| [Workflows](workflows.md) | Event-driven workflow documentation |
| [Use Cases](use-cases.md) | Actor-based use case catalog |
| [Technical Writeup](technical-writeup.md) | Technical deep-dive and trade-offs |
| [Hardware Requirements](hardware-requirements.md) | Infrastructure sizing guide |
| [Gap Analysis](gap-analysis.md) | Vision vs. implementation assessment |
| [Software Requirements](software-requirements.md) | Functional and non-functional requirements |
| [Technical Specifications](technical-specifications.md) | API contracts and data formats |
| [Deployment Guide](deployment.md) | Deployment procedures for all environments |
| [Release Notes](release-notes.md) | Version history and changelog |
| [Acceptance Criteria](acceptance-criteria.md) | Feature acceptance criteria |
| [Testing Requirements](testing-requirements-aidd.md) | AIDD testing strategy and coverage targets |
| [Performance Review (AIDD)](performance-review-aidd.md) | Performance gaps, implemented fixes, and validation evidence |
| [Backend Dual-Model Support (AIDD)](backend-dual-model-aidd.md) | Backend guardrails for single-merchant and marketplace frontend modes |
| [User Manual - Admin](user-manual-admin.md) | Administrator operations guide |
| [User Manual - End User](user-manual-enduser.md) | Customer shopping guide |
| [User Manual - Developer](user-manual-developer.md) | Developer setup and contribution guide |
| [Training - Admin](training-manual-admin.md) | Administrator training curriculum |
| [Training - End User](training-manual-enduser.md) | Customer training curriculum |
| [Training - Developer](training-manual-developer.md) | Developer training curriculum |
| [Training Video Scripts](training-video-scripts.md) | Video production scripts |
| [Design Prompts](design/Figma_Make_Prompts.md) | UI design and automation prompts |
| [Performance Design Prompt](design/Figma_Make_Performance_AIDD_Prompt.md) | AIDD-constrained high-performance Figma Make prompt |

## 13. Contributing

1. Create a feature branch from `main`: `git checkout -b feat/your-feature`
2. Follow the four-layer service pattern (index, app, service, repository)
3. Add event types to `@fusioncommerce/contracts` if needed
4. Write unit tests with InMemory implementations
5. Use conventional commit messages: `feat:`, `fix:`, `docs:`, `chore:`
6. Open a pull request and ensure CI passes
7. Obtain code review approval before merging

## 14. License

Internal use only. See LICENSE file for details.
