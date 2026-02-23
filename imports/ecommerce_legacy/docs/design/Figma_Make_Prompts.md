# Figma Make Prompt Pack — Global-Class eCommerce (AIDD)
> Version: 2.0 | Last Updated: 2026-02-20 | Status: Active
> Classification: Internal | Author: AIDD System

## 1. How To Use This File
Use these prompts directly in Figma Make. This file provides two complete prompt sets:
1. Single-merchant experience running on a multitenant platform.
2. Marketplace experience (Amazon-class breadth and scale).

Each set includes:
1. A master product experience prompt.
2. A design-system and interaction prompt.
3. A Make automation prompt pack.
4. A validation checklist tied to AIDD guardrails.

## 2. AIDD Guardrails (Apply To All Prompts)
These are non-negotiable constraints in every generated output.

### 2.1 User Experience And Accessibility
- Meet WCAG 2.1 AA for color contrast, keyboard access, focus visibility, and semantic structure.
- Keep tap targets at least 44x44px on touch devices.
- Provide clear empty, loading, error, and success states for each async screen.
- Maintain plain-language labels and error messages.

### 2.2 Performance And Frontend Efficiency
- Design for route-level lazy loading and code splitting by default.
- Keep initial route JS budget under 220KB gzip on customer-facing routes.
- Avoid heavy always-mounted UI primitives; defer advanced widgets until needed.
- Keep animation subtle (150-200ms) and non-blocking.
- Enforce skeleton UIs and progressive content rendering.

### 2.3 Reliability, Trust, And Safety
- Build explicit recovery paths (retry, fallback, escalation) for checkout/payment/shipping flows.
- Expose trust signals: security badges, return windows, delivery commitments, review authenticity cues.
- Include fraud/risk checkpoints without harming conversion.

### 2.4 Observability And Testability
- Every critical flow should define analytics events, error events, and conversion checkpoints.
- Produce handoff notes that map UI states to test cases (unit, integration, E2E).
- Include performance instrumentation surfaces (LCP, INP, CLS, API latency markers).

## 3. Prompt Set A: Single-Merchant UI On Multitenant Platform

### 3.1 Product Intent
Design a premium direct-to-consumer experience for one merchant storefront, while preserving multitenant operability in admin and configuration layers.

### 3.2 Figma Make Master Prompt (Copy/Paste)
"Design a world-class ecommerce experience for a single merchant brand that runs on a multitenant commerce platform. The buyer sees one branded storefront, while admins can switch tenant context securely.

Create responsive designs for desktop (1440), tablet (1024), and mobile (390).

Deliver these pages and flows:
1) Storefront home with hero, dynamic recommendations, campaign modules, social proof, and high-intent quick actions.
2) Search and category listing with fast filters, sticky sorting, predictive suggestions, and low-friction add-to-cart.
3) Product detail page with variants, media gallery, trust badges, delivery ETA, inventory confidence messaging, bundle and subscription options.
4) Cart and checkout with guest checkout, address autofill, shipping policy preview, payment method orchestration, coupon logic, and one-screen order review.
5) Order success and post-purchase center with tracking timeline, reorder, support, and return initiation.
6) Customer account center with orders, addresses, saved payments, subscriptions, and communication preferences.
7) Merchant admin shell with tenant-aware sidebar, role-aware visibility, product and inventory workflows, order management, promotion manager, and analytics overview.
8) Tenant switcher and onboarding states for operators managing multiple storefronts.

Workflow quality requirements:
- Primary purchase path must be completable in minimal steps with clear progress feedback.
- Support mobile-first one-thumb interactions for browse, add, and checkout tasks.
- Include high-quality empty/loading/error/success states for all key surfaces.
- Minimize cognitive load: clear hierarchy, strong visual grouping, concise microcopy.
- Include delight without friction: contextual help, clear next-best action, and post-purchase reassurance.

Performance requirements baked into design decisions:
- Define routes for lazy loading: Home, Listing, PDP, Cart, Checkout, Account, Admin.
- Avoid monolithic, always-rendered dashboard widgets.
- Prefer lightweight card/list patterns over dense nested containers.
- Provide placeholders/skeletons sized to final layout to prevent layout shift.

Deliverables:
- End-to-end flow map.
- Screen set for each route and state.
- Annotated component usage and responsive behavior.
- Handoff checklist aligned to AIDD guardrails (accessibility, performance, reliability, observability, testability)."

### 3.3 Figma Make Design-System Prompt (Copy/Paste)
"Create a modern design system for a premium single-merchant ecommerce brand on a multitenant platform.

Define:
1) Tokens: color roles, typography scale, spacing scale, radius, elevation, borders, motion timings.
2) Components: header, mega-menu, search, product card, media gallery, variant selector, price block, badges, cart item, checkout stepper, address form, payment selector, status timeline, admin table, chart primitives.
3) Variants and states: default, hover, active, focus-visible, loading, disabled, error, success, offline.
4) Content rules: truncation, line clamp policy, localization-safe spacing, number/currency formatting slots.
5) Accessibility overlays: contrast-ready palettes, focus order annotations, ARIA intent notes.

Visual direction:
- Clean premium retail aesthetic with strong readability and conversion clarity.
- Distinctive brand accents without noisy decoration.
- Balanced whitespace and rhythm to support fast scanning.

Engineering handoff requirements:
- Map each component to lazy-load boundary recommendations.
- Flag components likely to bloat bundle size and provide lightweight alternatives.
- Include analytics event map per component for critical actions.
- Include satisfaction measurement hooks: CSAT prompt trigger, return-friction events, rage-click indicators."

### 3.4 Make Automation Prompt Pack (Copy/Paste)
"Build Make scenarios for a single-merchant storefront on a multitenant platform:

Scenario A: Conversion Recovery
- Trigger: cart inactive for 30 minutes.
- Steps: fetch cart + customer profile, generate personalized recovery message, send via email/push/SMS based on preference, log campaign attribution.
- Guardrails: dedupe by cart ID, respect consent, stop when purchase completes.

Scenario B: Inventory and Merchandising Loop
- Trigger: low stock threshold or sudden demand spike.
- Steps: notify merchant team, adjust merchandising placement for low stock products, update PDP stock messaging, create procurement task.
- Guardrails: rate limit updates, rollback on sync failure.

Scenario C: Post-Purchase Satisfaction
- Trigger: order delivered event.
- Steps: send delivery confirmation, request review at configurable delay, open support branch if sentiment negative, route VIP issues to priority queue.
- Guardrails: avoid spam, no duplicate outreach, capture CSAT outcome.

Scenario D: Tenant Ops Health
- Trigger: periodic every 15 minutes.
- Steps: check payment, shipping, tax provider health by tenant, alert on degradation, switch to fallback provider when policy allows, log incident timeline.
- Guardrails: strict retry and timeout policy, audit logs preserved per tenant."

### 3.5 Validation Checklist (Set A)
- Checkout completion path designed for both guest and authenticated users.
- Tenant context is visible, safe, and cannot leak data across tenants.
- Customer routes and admin routes are split for lazy loading.
- Every critical action has loading/error/recovery UI.
- All high-impact events are instrumented for analytics and troubleshooting.

## 4. Prompt Set B: Marketplace (Amazon-Like)

### 4.1 Product Intent
Design a high-scale marketplace with high product breadth, many sellers, ranking/search complexity, trust and fulfillment transparency, and conversion-first UX across devices.

### 4.2 Figma Make Master Prompt (Copy/Paste)
"Design an Amazon-class marketplace experience that is highly performant, trustworthy, and easy to use across desktop, tablet, and mobile.

Frame sizes:
- Desktop 1440
- Tablet 1024
- Mobile 390

Create these domains and routes:
1) Marketplace Home: personalized discovery rails, deal windows, recently viewed, intent-aware shortcuts.
2) Search Results: relevance controls, sponsored placement labeling, seller filters, delivery-speed filters, price history hints.
3) Product Detail: buy box, seller comparison table, fulfillment options, delivery promise clarity, warranty and return trust blocks, authentic review system.
4) Multi-seller Cart: split shipments, per-seller policies, consolidation logic, clear fee/tax presentation.
5) Checkout: address intelligence, shipment grouping, payment orchestration (card/wallet/bank/BNPL), risk checks with non-blocking UX.
6) Order Tracking: per-package timeline, delay handling, partial delivery states, support escalation.
7) Buyer Account: orders, returns/refunds, subscriptions, communication and privacy controls.
8) Seller Console: catalog onboarding, listing quality score, inventory and pricing controls, advertising surfaces, payout dashboard, service-level indicators.
9) Marketplace Ops Console: seller risk review, fraud queues, dispute resolution, policy management, fulfillment SLA monitoring.

Core UX requirements:
- Maintain clarity despite high information density.
- Expose trust signals at each purchase decision point.
- Support power users without overwhelming casual shoppers.
- Keep cross-device continuity (saved cart, recently viewed, partially completed checkout).
- Add proactive assistance patterns (delivery-risk warnings, smart alternatives, one-tap support escalation).

Performance and scalability requirements:
- Define route-level lazy loading boundaries for Buyer, Seller, and Ops apps.
- Use progressive disclosure for heavy data modules (charts, dense tables, recommendations).
- Keep above-the-fold payload minimal; defer non-critical panels.
- Require image strategy: responsive sources, modern formats, and lazy loading below fold.
- Ensure no single UI surface depends on a single blocking API.

Deliverables:
- Complete IA and navigation map.
- End-to-end flows for buyer, seller, and ops personas.
- Full state coverage: loading, empty, degraded service, and recovery.
- AIDD-aligned handoff checklist with measurable acceptance criteria."

### 4.3 Figma Make Design-System Prompt (Copy/Paste)
"Create a marketplace-scale design system that handles both consumer storefront and operational consoles while staying cohesive.

Build token foundations for:
1) Brand-neutral commerce core tokens and role-based semantic colors.
2) Typography for dense data and consumer readability.
3) Motion with strict performance limits.
4) Grid and spacing rules for catalog browsing and console workflows.

Build component families:
- Marketplace navigation (global header, mega category, intent shortcuts).
- Search primitives (query bar, facet panels, result chips, applied filter summary).
- Commerce primitives (product card, buy box, seller comparison, delivery promise module, offer badge).
- Trust primitives (verified review marker, policy badge, seller score card).
- Operations primitives (data table, queue panel, incident timeline, KPI tile, trend chart).

State coverage:
- All interactive components must include keyboard, focus-visible, and touch behavior.
- Each component must define skeleton and error fallback variants.

Engineering handoff:
- Mark components by bundle-weight risk: light, medium, heavy.
- For heavy components, define lazy mount trigger and fallback placeholder.
- Provide telemetry hooks for search performance, conversion, funnel drop-off, and satisfaction trend monitoring."

### 4.4 Make Automation Prompt Pack (Copy/Paste)
"Build Make scenarios for a global marketplace platform:

Scenario A: Seller Quality and Catalog Health
- Trigger: listing created or updated.
- Steps: validate content quality, check policy compliance, compute quality score, request seller fixes, route severe violations to moderation queue.
- Guardrails: auditable decisions, explainability notes, per-seller throttling.

Scenario B: Dynamic Pricing and Offer Ranking Assist
- Trigger: price or inventory change, competitor signal update.
- Steps: evaluate pricing rules, update offer ranking hints, notify sellers of actionable opportunities, log rationale.
- Guardrails: enforce fairness policy and anti-manipulation checks.

Scenario C: Fulfillment and Delivery Promise Reliability
- Trigger: shipment status delay or SLA risk signal.
- Steps: notify buyer proactively, suggest alternative fulfillment path, alert seller and ops, open compensation workflow when policy criteria are met.
- Guardrails: no repeated alerts for same incident, strict timeline tracking.

Scenario D: Trust and Safety Response Loop
- Trigger: spike in refund/chargeback/fraud flags.
- Steps: correlate events by seller/product/payment fingerprint, escalate risk tier, temporarily limit risky actions, notify trust-and-safety team.
- Guardrails: least-privilege data handling, immutable audit trail, manual override path.

Scenario E: Marketplace Revenue Intelligence
- Trigger: daily schedule at 08:00 UTC.
- Steps: compute GMV, conversion, AOV, repeat purchase rate, top categories, failed checkout reasons, seller SLA distribution; send exec summary and ops deep-link report.
- Guardrails: tenant and region segmentation, privacy-safe aggregation."

### 4.5 Validation Checklist (Set B)
- Buyer, seller, and ops journeys are complete and connected.
- High-density pages remain readable and task-oriented.
- Trust, policy, and fulfillment clarity is explicit at decision points.
- Route-level lazy loading is intentionally designed for each persona app.
- Recovery and incident UX is present for degraded dependencies.

## 5. Shared Performance Acceptance Targets For Both Sets
Use these in handoff and review:

- LCP: <= 2.5s at p75 on mid-tier mobile (4G).
- INP: <= 200ms at p75.
- CLS: <= 0.10.
- Time to first actionable interaction on key routes: <= 1.8s target.
- JavaScript route budget: keep initial route payload lean and defer non-critical modules.
- Product image strategy: responsive `srcset`, WebP/AVIF, lazy below fold, explicit dimensions.
- API interaction UX: optimistic where safe, timeout feedback at 2-3s, user-visible retry path.

## 6. AIDD Handoff Gate Template (Attach To Every Generated Design)
1. Accessibility gate passed (contrast, focus, keyboard, screen-reader intent).
2. Performance gate passed (route budgets, lazy boundaries, rendering stability).
3. Reliability gate passed (error/retry/offline/degraded behavior defined).
4. Observability gate passed (events, funnel checkpoints, performance marks).
5. Testability gate passed (state matrix mapped to automated tests).
6. Security and privacy gate passed (least data exposure, consent-aware flows, auditability).

## 7. Output Packaging Convention
Request Figma Make outputs under these pages:
- `00_Context`
- `01_IA_Flows`
- `02_Screens_Desktop`
- `03_Screens_Mobile`
- `04_Components`
- `05_Tokens`
- `06_States_And_Errors`
- `07_Observability_And_Testability`
- `08_Handoff_AIDD_Checklist`
