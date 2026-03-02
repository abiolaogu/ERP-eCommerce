# ERP-eCommerce - Phase 2: Eventing and Realtime

Last updated: 2026-02-28

## Objectives

- Category: **Composable eCommerce**
- North-star: Power high-growth commerce with event-native, composable services and AI optimization.
- Benchmarks: Shopify, CommerceTools, BigCommerce

## Expected Outcomes

- Critical workflows emit durable event contracts through Redpanda.
- Realtime channels are tenant-scoped and role-aware.
- Replay-safe idempotency is required for all consumers.

## Implementation Steps

- Implement topic contracts from `infra/sovereign/events/topic-contracts.yaml`.
- Use outbox/CDC style publish path for transactional integrity.
- Fan out UX updates via channel contracts in `infra/sovereign/realtime`.

## AIDD Guardrail Alignment

- Autonomous: low-risk, high-confidence operations only.
- Supervised: approvals required for high-value or broad-impact operations.
- Protected: cross-tenant, privilege-escalation, and destructive unsafe actions are blocked.

## Domain Event Focus

- Contract and test flow for `ecommerce.orders`
- Contract and test flow for `ecommerce.catalog`
- Contract and test flow for `ecommerce.customer`
