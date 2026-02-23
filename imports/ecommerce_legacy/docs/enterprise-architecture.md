# Enterprise Architecture -- eCommerce Platform

## 1. Enterprise Context

FusionCommerce operates within the Business Activation Cloud (BAC) ecosystem, serving as the commerce backbone for multi-tenant marketplace deployments. The platform integrates with BAC's Global Anycast Platform for edge delivery, DDoS protection, and multi-region DNS management. This document maps FusionCommerce capabilities to enterprise architecture domains following a TOGAF-aligned approach.

## 2. Business Architecture

### 2.1 Value Streams

| Value Stream | Description | FusionCommerce Services |
|-------------|-------------|------------------------|
| Product Discovery | Customer finds and evaluates products | Catalog Service, AI Recommendation Engine, Community/UGC |
| Order Fulfillment | End-to-end from purchase to delivery | Orders, Inventory, Payments, Shipping Services |
| Social Commerce | Group buying and social sharing flows | Group Commerce Service, Livestream Commerce |
| Vendor Management | Onboarding and managing marketplace sellers | Catalog (vendor products), Multi-tenant isolation |
| Business Intelligence | Real-time operational analytics | Apache Druid, AI Decisioning Plane |
| Platform Operations | Infrastructure management and monitoring | Kubernetes, Observability Stack |

### 2.2 Business Capability Model

```
FusionCommerce Business Capabilities
|
+-- Core Commerce
|   +-- Product Information Management (Catalog Service)
|   +-- Order Management (Orders Service)
|   +-- Inventory Management (Inventory Service)
|   +-- Payment Processing (Payments Service)
|   +-- Fulfillment Management (Shipping Service)
|
+-- Social Commerce
|   +-- Group Buying (Group Commerce Service)
|   +-- Livestream Shopping (Livestream Service - planned)
|   +-- Community Trust (Community/UGC Service - planned)
|
+-- Financial Services
|   +-- Digital Wallet (Wallet Service - planned)
|   +-- Loyalty Programs (Loyalty Service - planned)
|   +-- BNPL Integration (Payments Service extension)
|
+-- Intelligence
|   +-- Personalization (AI Recommendation - planned)
|   +-- Dynamic Pricing (AI Pricing - planned)
|   +-- Fraud Prevention (AI Fraud Detection - planned)
|   +-- Operational Analytics (Druid Dashboards - planned)
|
+-- Platform Operations
    +-- Multi-Tenant Management
    +-- Event Orchestration (Kafka + n8n)
    +-- CI/CD Pipeline (GitHub Actions)
    +-- Edge Delivery (BAC Anycast)
```

### 2.3 Organization Mapping

| Organizational Unit | Responsibilities | Platform Touchpoints |
|--------------------|-----------------|---------------------|
| Platform Engineering | Service development, CI/CD, infrastructure | All services, Docker, Kubernetes, GitHub Actions |
| Commerce Operations | Vendor onboarding, catalog curation, order monitoring | Catalog, Orders, n8n workflows |
| Data Science | AI model development, analytics | Druid, AI services, Kafka streams |
| Security & Compliance | AuthN/AuthZ, PCI DSS, GDPR | API Gateway, secret management, audit logs |
| BAC Infrastructure | Anycast platform, DNS, DDoS protection | Cloudflare, Voxility, OpenStack |

## 3. Application Architecture

### 3.1 Application Portfolio

| Application | Type | Status | Technology |
|------------|------|--------|-----------|
| Catalog Service | Microservice | Production-ready | TypeScript, Fastify, Kafka |
| Orders Service | Microservice | Production-ready | TypeScript, Fastify, Kafka, Knex/PostgreSQL |
| Inventory Service | Microservice | Production-ready | TypeScript, Fastify, Kafka, Knex/PostgreSQL |
| Group Commerce Service | Microservice | Production-ready | TypeScript, Fastify, Kafka, Knex/PostgreSQL |
| Payments Service | Microservice | Scaffolded | TypeScript, Fastify, Stripe |
| Shipping Service | Microservice | Scaffolded | TypeScript, Fastify |
| n8n Workflow Engine | COTS (Configured) | Deployed | n8n v1.70.1 |
| Redpanda | COTS (Deployed) | Operational | Redpanda (Kafka-compatible) |
| Event Bus Library | Shared Library | Complete | TypeScript, kafkajs |
| Contracts Library | Shared Library | Complete | TypeScript |
| Database Library | Shared Library | Complete | TypeScript, Knex |

### 3.2 Application Integration Map

```
                    +-------------+
                    | Storefronts |
                    |  (Planned)  |
                    +------+------+
                           |
                    REST / HTTP
                           |
    +--------+--------+--------+--------+--------+
    |        |        |        |        |        |
 Catalog  Orders  Inventory  Group   Payments Shipping
    |        |        |      Commerce    |        |
    +--------+--------+--------+--------+--------+
                           |
                     Kafka Events
                           |
              +------------+------------+
              |            |            |
           n8n          Druid        AI Plane
         Workflows    Analytics    (Planned)
```

### 3.3 Application Interaction Patterns

| Pattern | Usage | Example |
|---------|-------|---------|
| Request/Response | Client-to-service API calls | POST /orders creates order synchronously |
| Publish/Subscribe | Service-to-service event propagation | order.created triggers inventory reservation |
| Choreography | Multi-service coordination without central orchestrator | Order -> Inventory -> Payment chain via events |
| Orchestration | Centralized workflow coordination | n8n coordinates fraud check, payment, notification |

## 4. Data Architecture

### 4.1 Data Domains

| Domain | Owner Service | Data Classification | Storage Target |
|--------|--------------|-------------------|----------------|
| Product Data | Catalog Service | Business | YugabyteDB |
| Order Data | Orders Service | Financial/Sensitive | YugabyteDB |
| Inventory Data | Inventory Service | Operational | YugabyteDB |
| Campaign Data | Group Commerce | Business | YugabyteDB |
| Payment Data | Payments Service | Financial/PCI | YugabyteDB (tokenized) |
| Session Data | API Gateway | Transient | ScyllaDB/Aerospike |
| Media Assets | Catalog/Community | Binary/Unstructured | MinIO |
| Event Streams | All Services | Operational/Audit | Kafka (Redpanda) |
| Analytics Data | Druid | Analytical | Apache Druid segments |

### 4.2 Data Flow Architecture

```
Operational Plane:
  Services --publish--> Kafka Topics --consume--> Services
                            |
                            v
Analytical Plane:
  Kafka Topics --ingest--> Apache Druid --query--> Dashboards
                                                        |
                                                        v
Intelligence Plane:
  Druid Insights + Kafka Events --> AI Services --> Action Events --> Kafka
```

### 4.3 Data Governance

| Principle | Implementation |
|-----------|----------------|
| Data Ownership | Each service owns its bounded context data; no shared databases |
| Schema Evolution | @fusioncommerce/contracts package versioned with semver |
| Data Retention | Kafka topic retention configurable (default 7 days); database retention per regulatory requirement |
| Data Residency | YugabyteDB geo-partitioning for regional data compliance |
| PCI Compliance | Stripe tokenization -- no raw card data in platform |

## 5. Technology Architecture

### 5.1 Technology Standards

| Layer | Standard | Rationale |
|-------|----------|-----------|
| Language | TypeScript 5.x | Type safety, developer productivity, ecosystem |
| Runtime | Node.js 20 LTS | Long-term support, performance, Alpine image size |
| HTTP Framework | Fastify 4.x | High performance, schema validation, plugin ecosystem |
| Event Streaming | Apache Kafka (Redpanda) | Industry standard, durable, high-throughput |
| SQL Database | PostgreSQL / YugabyteDB | ACID compliance, YugabyteDB adds distributed consistency |
| NoSQL | ScyllaDB or Aerospike | Sub-millisecond latency for real-time counters |
| Object Storage | MinIO | S3-compatible, self-hosted, performant |
| Analytics | Apache Druid | Real-time OLAP on streaming data |
| Orchestration | n8n | Low-code workflow automation with Kafka integration |
| Containerization | Docker | Multi-stage builds, reproducible deployments |
| Container Orchestration | Kubernetes (Rancher) | Industry standard, autoscaling, declarative management |
| CI/CD | GitHub Actions + ArgoCD | Source-integrated CI, GitOps-based CD |
| Edge | Cloudflare + Voxility | CDN, DDoS protection, anycast routing |

### 5.2 Technology Radar

| Category | Adopt | Trial | Assess | Hold |
|----------|-------|-------|--------|------|
| Languages | TypeScript | | Rust (performance services) | |
| Databases | PostgreSQL, YugabyteDB | ScyllaDB | Aerospike | MongoDB |
| Streaming | Kafka/Redpanda | | Pulsar | RabbitMQ |
| Frameworks | Fastify | | tRPC | Express |
| Orchestration | Kubernetes, n8n | ArgoCD | Temporal | Manual deploys |
| Observability | Prometheus, Grafana | OpenTelemetry | | ELK Stack |

## 6. Security Architecture

### 6.1 Security Zones

```
Zone 1: Public Internet
  |-- Cloudflare WAF / DDoS Protection
  |
Zone 2: Edge / DMZ
  |-- API Gateway (JWT validation, rate limiting)
  |
Zone 3: Application Tier
  |-- Microservices (internal only after gateway)
  |-- n8n (internal only)
  |
Zone 4: Data Tier
  |-- PostgreSQL / YugabyteDB (no external access)
  |-- Kafka / Redpanda (no external access)
  |-- MinIO (no external access)
  |
Zone 5: Management Plane
  |-- Kubernetes API (RBAC controlled)
  |-- CI/CD (GitHub Actions, ArgoCD)
  |-- Monitoring (Prometheus, Grafana)
```

### 6.2 Authentication and Authorization Matrix

| Actor | Authentication | Authorization |
|-------|---------------|--------------|
| End Consumer | JWT (OAuth 2.0) | Role: customer |
| Marketplace Vendor | JWT (OAuth 2.0) | Role: vendor, scoped to tenant_id |
| Platform Admin | JWT + MFA | Role: admin |
| Service-to-Service | mTLS certificates | Service mesh policies |
| n8n Workflows | API keys / service accounts | Workflow-specific permissions |
| CI/CD Pipeline | GitHub OIDC tokens | Deploy permissions per namespace |

## 7. Integration Architecture

### 7.1 External System Integration

| External System | Integration Pattern | Protocol | Data Flow |
|----------------|-------------------|----------|-----------|
| Stripe | API Client | HTTPS REST | Payments: create charge, refund, webhook |
| Carrier APIs (FedEx, UPS, DHL) | API Client | HTTPS REST | Shipping: label creation, tracking |
| SMS Gateway (Twilio) | API Client | HTTPS REST | Notifications: order confirmation, shipping updates |
| Email Service (SES/SendGrid) | API Client | HTTPS REST | Notifications: receipts, marketing |
| BAC Anycast Platform | Pydantic Config | DNS API | Edge routing, DDoS thresholds |

### 7.2 Internal Integration Standards

- All inter-service communication through Kafka events (no direct service-to-service HTTP calls for state changes)
- Shared type definitions via @fusioncommerce/contracts npm package
- Event payloads are JSON-serialized with timestamp envelope
- Kafka consumer groups named `{topic}-consumer` for single-active-consumer semantics

## 8. Governance Model

### 8.1 Architecture Decision Records

All significant architecture decisions should be documented as ADRs in `docs/adr/` (not yet created). Key decisions to formalize:
- ADR-001: Monorepo with npm workspaces over polyrepo
- ADR-002: Kafka (Redpanda) as sole inter-service communication channel
- ADR-003: Repository pattern with in-memory and PostgreSQL implementations
- ADR-004: Fastify over Express for HTTP framework
- ADR-005: n8n for low-code workflow orchestration
- ADR-006: Multi-stage Docker builds for production images

### 8.2 Service Ownership

| Service | Team | Review Cadence |
|---------|------|---------------|
| Catalog, Orders, Inventory | Core Commerce Team | Weekly |
| Group Commerce, Livestream | Social Commerce Team | Weekly |
| Payments, Wallet | Financial Services Team | Weekly |
| Shipping, Hyperlocal | Fulfillment Team | Bi-weekly |
| AI Services, Druid | Data Science Team | Bi-weekly |
| Infrastructure, CI/CD | Platform Engineering | Daily |

## 9. Maturity Assessment

| Capability | Current Maturity | Target Maturity | Gap |
|-----------|-----------------|----------------|-----|
| Service Implementation | Level 2 (Partial) | Level 4 (Comprehensive) | 6+ services missing |
| Event Architecture | Level 3 (Operational) | Level 4 (Optimized) | Schema registry, DLQ |
| Data Management | Level 2 (Basic) | Level 4 (Polyglot) | Only PostgreSQL deployed |
| Security | Level 1 (Minimal) | Level 4 (Defense in depth) | No auth, no encryption |
| Observability | Level 1 (Logging) | Level 4 (Full stack) | No metrics, traces, dashboards |
| Deployment | Level 2 (Docker Compose) | Level 4 (GitOps K8s) | No Helm, no ArgoCD |
| Testing | Level 2 (Unit tests) | Level 4 (Full pyramid) | No e2e, contract, load tests |

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
