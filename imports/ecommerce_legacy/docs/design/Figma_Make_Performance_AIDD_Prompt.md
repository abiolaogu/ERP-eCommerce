# Figma Make Master Prompts (AIDD + Extreme Performance)
> Version: 2.0 | Last Updated: 2026-02-20
> Purpose: Performance-first prompt overlays for enterprise-grade ecommerce design generation.

Use these prompts when you want Figma Make to produce elite UX outcomes with strict AIDD guardrails.

## Prompt A: Single-Merchant Interface (Multitenant Platform)
"Design a production-grade ecommerce interface for a single merchant storefront on a multitenant platform. Prioritize fast interactions, minimal friction, and clean premium UI.

Required routes (desktop 1440, mobile 390):
1) Home
2) Listing/Search
3) Product Detail
4) Cart
5) Checkout
6) Order Confirmation + Tracking
7) Account
8) Merchant Admin + Tenant Switcher

AIDD quality gates (must be explicit in annotations):
- Accessibility: WCAG 2.1 AA, keyboard-first support, 44x44 mobile touch targets, visible focus state.
- Performance: route-level lazy loading plan, skeleton-first loading, zero layout shift in critical content.
- Reliability: define graceful degradation for pricing, shipping, payment, and recommendation failures.
- Observability: include analytics and error event map for each critical flow.
- Satisfaction: track CSAT/NPS prompts, return-friction signals, and support-escalation reasons.
- Testability: include state matrix for normal/loading/error/empty/offline/retry per route.
- Security/Privacy: tenant-safe context boundaries, consent-aware communications, minimal sensitive data exposure.

Performance thresholds to design for:
- LCP <= 2.5s p75
- INP <= 200ms p75
- CLS <= 0.10
- Time-to-action on key routes <= 1.8s target
- Keep initial route JS budget lean; defer non-critical modules and heavy widgets.

Design behavior constraints:
- Main conversion path should not exceed minimal decision steps.
- Keep forms compact with instant inline validation and clear recovery guidance.
- Use progressive disclosure for secondary details.
- Keep motion subtle (150-200ms) and never block user action.

Deliverables:
- Flow map + annotated screens.
- Route-level lazy-load boundaries.
- Component fallback variants.
- AIDD checklist page showing pass/fail status for each gate."

## Prompt B: Marketplace Interface (Amazon-Class)
"Design a high-scale marketplace platform with buyer, seller, and operations experiences. Objective: top-tier usability, trust, and speed at global marketplace complexity.

Required route families (desktop 1440, tablet 1024, mobile 390):
Buyer app:
1) Marketplace Home
2) Search Results + Facets
3) PDP with Buy Box + Seller Comparison
4) Multi-seller Cart
5) Checkout and Payment Orchestration
6) Orders + Returns

Seller app:
7) Seller Console Home
8) Listing Management
9) Inventory + Pricing
10) Fulfillment and SLA Tracking
11) Advertising + Promotions

Ops app:
12) Trust and Safety Queue
13) Dispute Resolution
14) Marketplace Health Dashboard

AIDD quality gates (must be explicit in annotations):
- Accessibility: AA compliance on data-dense and consumer screens.
- Performance: lazy-load by persona app and route; defer heavy charts/tables until invoked.
- Reliability: non-blocking fallbacks for search, ranking, pricing, inventory, and shipping dependencies.
- Observability: funnel and latency instrumentation for buyer, seller, and ops.
- Satisfaction: monitor buyer trust confidence, seller workflow friction, and support burden indicators.
- Testability: include route-by-route state matrix and automation-friendly acceptance criteria.
- Security/Privacy: role-based visibility, fraud-sensitive workflow controls, immutable audit touchpoints.

Performance thresholds to design for:
- LCP <= 2.5s p75 (buyer surfaces)
- INP <= 200ms p75 (core interactions)
- CLS <= 0.10
- Search result interaction readiness <= 2.0s target
- Defer non-critical recommendation rails and analytics widgets by default.

Experience constraints:
- Maintain clarity in high-density interfaces through visual hierarchy and task grouping.
- Show trust signals at each decision point (seller quality, policy clarity, delivery promise).
- Provide error recovery and escalation paths without forcing users to restart flow.
- Preserve continuity across devices for cart, browsing, and checkout progress.

Deliverables:
- Persona journey map (buyer/seller/ops).
- Route architecture and lazy-loading plan.
- State coverage and fallback matrix.
- AIDD gate report with pass/fail checklist and remediation notes."

## AIDD Review Checklist (Attach To Generated Output)
1. Accessibility: contrast, keyboard, focus, touch, semantic hierarchy.
2. Performance: route budgets, lazy boundaries, skeletons, layout stability.
3. Reliability: failure states, retries, degraded-mode UX, support escalation.
4. Observability: analytics, funnel markers, performance metrics, error taxonomy.
5. Satisfaction: CSAT/NPS triggers, friction telemetry, support-deflection tracking.
6. Testability: deterministic UI states mapped to unit/integration/E2E cases.
7. Security and Privacy: role boundaries, consent, least-privilege exposure, auditability.
