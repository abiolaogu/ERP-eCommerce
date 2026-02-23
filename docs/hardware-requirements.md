# Hardware Requirements -- eCommerce Platform

## 1. Overview

This document specifies the hardware requirements for deploying the FusionCommerce eCommerce Platform across development, staging, and production environments. Requirements are derived from the platform's microservices architecture, polyglot persistence layer, event streaming infrastructure, and projected workload characteristics.

## 2. Development Environment

### 2.1 Developer Workstation

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores (x86_64 or Apple Silicon) | 8+ cores |
| RAM | 16 GB | 32 GB |
| Storage | 50 GB SSD | 100 GB NVMe SSD |
| OS | macOS 13+, Ubuntu 22.04+, Windows 11 (WSL2) | macOS 14+ or Ubuntu 24.04 |
| Docker | Docker Desktop 4.x with 8 GB RAM allocated | 12 GB RAM allocated |

**Justification**: Docker Compose runs 8 containers (Redpanda, 6 services, n8n). Redpanda alone requires 1 GB reserved memory. Node.js build processes for TypeScript compilation across workspaces benefit from multi-core CPUs.

### 2.2 Docker Compose Resource Allocation

| Container | CPU Limit | Memory Limit | Storage |
|-----------|-----------|-------------|---------|
| Redpanda | 1 core | 1 GB | 5 GB |
| catalog-service | 0.25 core | 256 MB | 100 MB |
| orders-service | 0.25 core | 256 MB | 100 MB |
| inventory-service | 0.25 core | 256 MB | 100 MB |
| group-commerce-service | 0.25 core | 256 MB | 100 MB |
| payments-service | 0.25 core | 256 MB | 100 MB |
| shipping-service | 0.25 core | 256 MB | 100 MB |
| n8n | 0.5 core | 512 MB | 1 GB |
| **Total** | **3 cores** | **3 GB** | **7 GB** |

## 3. Staging Environment

### 3.1 Kubernetes Cluster (Staging)

| Component | Quantity | Specs per Node |
|-----------|----------|---------------|
| Control Plane Nodes | 1 | 4 vCPU, 8 GB RAM, 100 GB SSD |
| Worker Nodes | 3 | 4 vCPU, 16 GB RAM, 200 GB SSD |
| Total Cluster | 4 nodes | 16 vCPU, 56 GB RAM, 700 GB SSD |

### 3.2 Staging Service Allocation

| Workload | Replicas | CPU Request | CPU Limit | Memory Request | Memory Limit |
|----------|----------|-------------|-----------|----------------|-------------|
| Catalog Service | 1 | 250m | 500m | 256Mi | 512Mi |
| Orders Service | 1 | 500m | 1000m | 512Mi | 1Gi |
| Inventory Service | 1 | 500m | 1000m | 512Mi | 1Gi |
| Group Commerce | 1 | 250m | 500m | 256Mi | 512Mi |
| Payments Service | 1 | 500m | 1000m | 512Mi | 1Gi |
| Shipping Service | 1 | 250m | 500m | 256Mi | 512Mi |
| Redpanda | 1 | 1000m | 2000m | 2Gi | 4Gi |
| n8n | 1 | 250m | 500m | 512Mi | 1Gi |
| PostgreSQL | 1 | 1000m | 2000m | 2Gi | 4Gi |

### 3.3 Staging Storage

| Volume | Size | Type | Purpose |
|--------|------|------|---------|
| PostgreSQL data | 50 GB | SSD PV | Transactional data |
| Redpanda data | 50 GB | SSD PV | Event log retention |
| n8n data | 10 GB | SSD PV | Workflow definitions |
| MinIO data | 100 GB | HDD PV | Media assets |

## 4. Production Environment

### 4.1 Kubernetes Cluster (Production)

| Component | Quantity | Specs per Node |
|-----------|----------|---------------|
| Control Plane Nodes | 3 (HA) | 4 vCPU, 16 GB RAM, 100 GB NVMe |
| Application Worker Nodes | 6 | 8 vCPU, 32 GB RAM, 200 GB NVMe |
| Data Worker Nodes | 3 | 8 vCPU, 64 GB RAM, 1 TB NVMe |
| Edge/Ingress Nodes | 2 | 4 vCPU, 8 GB RAM, 100 GB SSD |
| Total Cluster | 14 nodes | 88 vCPU, 352 GB RAM, 4.2 TB NVMe |

### 4.2 Production Service Allocation

| Workload | Replicas | CPU Request | CPU Limit | Memory Request | Memory Limit |
|----------|----------|-------------|-----------|----------------|-------------|
| Catalog Service | 3 | 500m | 1000m | 512Mi | 1Gi |
| Orders Service | 3 | 1000m | 2000m | 1Gi | 2Gi |
| Inventory Service | 3 | 1000m | 2000m | 1Gi | 2Gi |
| Group Commerce | 2 | 500m | 1000m | 512Mi | 1Gi |
| Payments Service | 3 | 1000m | 2000m | 1Gi | 2Gi |
| Shipping Service | 2 | 500m | 1000m | 512Mi | 1Gi |
| Redpanda | 3 | 2000m | 4000m | 4Gi | 8Gi |
| n8n | 2 | 500m | 1000m | 1Gi | 2Gi |
| YugabyteDB | 3 | 4000m | 8000m | 8Gi | 16Gi |
| ScyllaDB | 3 | 2000m | 4000m | 4Gi | 8Gi |
| MinIO | 4 | 1000m | 2000m | 2Gi | 4Gi |
| Apache Druid | 3 | 2000m | 4000m | 4Gi | 8Gi |
| AI Services | 2 | 2000m | 4000m | 4Gi | 8Gi |

### 4.3 Production Storage

| Volume | Size | Type | IOPS | Purpose |
|--------|------|------|------|---------|
| YugabyteDB data | 500 GB x 3 | NVMe PV | 10,000 | Transactional data |
| Redpanda data | 1 TB x 3 | NVMe PV | 5,000 | Event log (7-day retention) |
| ScyllaDB data | 200 GB x 3 | NVMe PV | 20,000 | Low-latency data |
| MinIO data | 5 TB x 4 | HDD PV | 500 | Media and object storage |
| Druid segments | 500 GB x 3 | SSD PV | 3,000 | Analytics data |
| n8n data | 20 GB | SSD PV | 1,000 | Workflow state |

## 5. Network Requirements

### 5.1 Internal Network

| Requirement | Specification |
|-------------|---------------|
| Network bandwidth (node-to-node) | 10 Gbps minimum |
| Latency (within cluster) | < 1ms |
| CNI plugin | Calico or Cilium |
| Service mesh | Istio or Linkerd (optional, recommended for mTLS) |

### 5.2 External Network

| Requirement | Specification |
|-------------|---------------|
| Internet bandwidth | 1 Gbps dedicated |
| CDN | Cloudflare with Anycast |
| DDoS protection | Voxility / Cloudflare (per BAC anycast config) |
| SSL/TLS termination | At ingress controller or CDN |
| DNS | PowerDNS with BAC anycast configuration |

### 5.3 Firewall Rules

| Source | Destination | Port | Protocol | Purpose |
|--------|-------------|------|----------|---------|
| Internet | Ingress | 443 | HTTPS | API and storefront traffic |
| Ingress | Services | 3000-3005 | HTTP | Service routing |
| Services | Redpanda | 9092 | TCP | Kafka events |
| Services | YugabyteDB | 5433 | TCP | Database queries |
| Services | ScyllaDB | 9042 | TCP | Low-latency queries |
| Services | MinIO | 9000 | HTTP | Object storage |
| n8n | Services | 3000-3005 | HTTP | Workflow orchestration |
| n8n | Redpanda | 9092 | TCP | Kafka trigger |
| Services | Stripe API | 443 | HTTPS | Payment processing |

## 6. Disaster Recovery Hardware

### 6.1 Secondary Region

| Component | Quantity | Notes |
|-----------|----------|-------|
| K8s Worker Nodes | 3 | Warm standby, can scale up |
| YugabyteDB replicas | 2 | Async geo-replication |
| Redpanda replicas | 1 | MirrorMaker topic replication |
| MinIO replicas | 2 | Bucket replication |

### 6.2 Backup Storage

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Database snapshots | Every 6 hours | 30 days | S3-compatible cold storage |
| Kafka topic backups | Daily | 90 days | S3-compatible cold storage |
| MinIO mirror | Real-time | N/A | Secondary MinIO cluster |
| Configuration backups | On change | 1 year | Git repository |

## 7. Monitoring Hardware

| Component | Specs | Purpose |
|-----------|-------|---------|
| Prometheus server | 4 vCPU, 16 GB RAM, 500 GB SSD | Metrics collection and storage |
| Grafana server | 2 vCPU, 4 GB RAM, 50 GB SSD | Dashboard rendering |
| Jaeger collector | 4 vCPU, 8 GB RAM, 200 GB SSD | Distributed trace storage |
| Log aggregator (Loki) | 4 vCPU, 16 GB RAM, 1 TB HDD | Log storage and query |

## 8. GPU Requirements (AI Services)

If deploying AI-driven services locally (rather than using cloud AI APIs):

| Service | GPU | VRAM | Quantity |
|---------|-----|------|----------|
| Recommendation Engine | NVIDIA A10 | 24 GB | 1 |
| Fraud Detection | NVIDIA T4 | 16 GB | 1 |
| Dynamic Pricing | CPU-only | N/A | 0 |

For initial deployments, cloud-based AI inference (AWS SageMaker, Google Vertex AI) is recommended over on-premise GPU investment.

## 9. Cost Estimation (Cloud)

### 9.1 Monthly Cloud Cost (AWS Reference)

| Component | Instance Type | Count | Monthly Cost (est.) |
|-----------|--------------|-------|-------------------|
| Application nodes | c6i.2xlarge | 6 | $3,600 |
| Data nodes | r6i.2xlarge | 3 | $2,700 |
| Control plane | m6i.xlarge | 3 | $1,200 |
| EBS storage | gp3 | 10 TB | $800 |
| Network transfer | | 5 TB/mo | $450 |
| Load balancer | ALB | 1 | $200 |
| **Total** | | | **$8,950/mo** |

### 9.2 On-Premise Cost (3-Year TCO)

| Component | Cost |
|-----------|------|
| Server hardware (14 nodes) | $120,000 |
| Network switches (10G) | $15,000 |
| NVMe storage (20 TB) | $20,000 |
| Rack, power, cooling | $10,000/year |
| **3-Year Total** | **$185,000** |

---

*Document version: 1.0*
*Last updated: 2026-02-17*
*Product: FusionCommerce eCommerce Platform*
