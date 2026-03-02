# ERP-eCommerce - Phase 0: Foundation and Tooling

Last updated: 2026-02-28

## Objectives

- Category: **Composable eCommerce**
- North-star: Power high-growth commerce with event-native, composable services and AI optimization.
- Benchmarks: Shopify, CommerceTools, BigCommerce

## Expected Outcomes

- Repository baseline, env contracts, and dependency hygiene are deterministic.
- AIDD guardrail policy is versioned and audited.
- CI has baseline lint, test, build, and policy checks.

## Implementation Steps

- Standardize `.env.example` and secrets source mapping.
- Lock entrypoint telemetry and tenant/request correlation IDs.
- Validate generated guardrail and release-gate artifacts.

## AIDD Guardrail Alignment

- Autonomous: low-risk, high-confidence operations only.
- Supervised: approvals required for high-value or broad-impact operations.
- Protected: cross-tenant, privilege-escalation, and destructive unsafe actions are blocked.

## Domain Event Focus

- Contract and test flow for `ecommerce.orders`
- Contract and test flow for `ecommerce.catalog`
- Contract and test flow for `ecommerce.customer`
