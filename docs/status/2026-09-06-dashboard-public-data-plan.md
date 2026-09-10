# Main dashboard — approved-design continuation

Scope: restore the existing dark control-plane dashboard against the persisted public research run. Preserve the three-lane layout, market ranking and evidence matrix; do not redesign the product or enable external actions.

## Delivery checklist

- [x] Reproduce public-source rejection and unknown activity audit event in tests.
- [x] Version the public-research read contract; retain strict synthetic/public provenance, tenant, outbound, cap and audit guards.
- [x] Render the recorded audit feed and a native link to the detailed Market Scout evidence, using existing design tokens.
- [x] Verify safe empty/error states and desktop/mobile rendering against the existing design.
- [x] Run unit/component tests, restricted database tests, typecheck and lint; capture the actual local dashboard.

No new discovery request, company import, message, payment, credential change, database rewrite or deployment is part of this work. Existing data must remain unchanged. Translation and autonomous-agent execution are not claimed delivered by this slice.

Acceptance: docs/status/2026-09-06-dashboard-public-data-acceptance.md. Mobile retains the existing internally scrollable analysis tables; no whole-page horizontal overflow was observed. This is a local dashboard-integration delivery, not full product or production acceptance.
