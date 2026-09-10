# Dashboard Phase 2A.1 — English-only status

- Date: 2026-09-04
- Status: `IMPLEMENTED_LOCAL_AND_VERIFIED`
- Final owner direction: English-only and LTR for now.
- Despite the historical `i18n` status filename, this phase adds no internationalization layer, locale routing, language switch, translation catalog, persisted locale, or bilingual infrastructure.
- Scope remains the Phase 2A dashboard shell: Safety Context, compact header, and the three parallel ServiceFlow, BeautyFlow, and BriefFlow lanes.
- This status does not claim deployment, production readiness, provider connectivity, outbound capability, or PostgreSQL integration coverage.

## Implemented behavior

- The root document is `lang="en"` and `dir="ltr"`; the dashboard main surface is also explicitly LTR.
- All Phase 2A.1 UI labels, accessibility names, loading copy, malformed-payload error copy, pack-state labels, ledger labels, and cap labels are English.
- Runtime browser inspection found no Persian characters in the rendered dashboard. A source check found no Persian literals in `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, or `src/components/growth-dashboard.tsx`.
- Existing Persian strings in domain manifests and market research configuration are not rendered by the current Phase 2A.1 dashboard and were intentionally left outside this UI-only change.
- Numeric formatting now uses `en-US` without grouping, preserving the existing compact cap display.

## Preserved safety and provenance

- `DEMO`, `SYNTHETIC DATA`, `RESEARCH-ONLY`, and `Outbound = 0` remain sourced from the Phase 1 read model and remain visually prominent.
- The interface still states that messages, calls, ads, bookings, purchases, and external actions are prohibited in this environment.
- Missing run, source, stop-reason, and usage observations remain explicit `MISSING` values. No absent value is silently converted to zero.
- The client still reads only same-origin `GET /api/dashboard` with `cache: no-store` and rejects structurally malformed payloads before rendering.
- No button or outbound action is rendered.

## TDD evidence

- RED: the five focused Phase 2A.1 tests all failed against the previous Persian/RTL interface for the expected language, direction, copy, loading, and error-state reasons.
- GREEN: after the minimal UI conversion, the focused suite passed `5/5` tests.
- Final non-integration suite: `26/26` files and `154/154` tests passed.
- ESLint: passed with zero reported errors.
- TypeScript `--noEmit`: passed with zero reported errors.
- Next.js `16.3.4` optimized build: passed; `/` and `/api/dashboard` remain dynamic routes.

## Browser QA evidence

- Browser: Codex in-app browser against the local demo runtime.
- Exact comparison viewport: `1487 × 1058` CSS pixels, device pixel ratio `1`.
- Exact viewport checks: three lanes, 27 explicit `MISSING` values, zero buttons, no Persian visible text, and no horizontal overflow.
- Standard desktop check at `1280 × 720`: three columns, no Persian visible text, and no horizontal overflow.
- Accessibility tree: named main, Safety Context, three-agent region, and all three lane articles were present.
- Startup/ready-state console probe: zero warnings, errors, page errors, or unhandled rejections. The temporary probe and temporary screenshot route were removed before final verification.
- Visual comparison: no actionable P0/P1/P2 mismatch within the accepted Phase 2A.1 scope. See `design-qa.md`.
- Screenshot: `docs/status/2026-09-04-dashboard-phase-2a1-english-implementation.jpg`.

## Deliberate limits

- The source reference's market ranking, evidence matrix, audit feed, and actions remain later-phase work.
- No provider, external API, advertisement, booking, purchase, message, credential, Human-Send, or outbound gateway was added or enabled.
- PostgreSQL integration tests were not run because no secure `TEST_DATABASE_URL` was provided; no credential was guessed or stored.
- Mobile visual acceptance remains a P3 gap because no mobile source target or approved mobile direction exists.

Result: Phase 2A.1 is locally implemented and freshly verified as an English-only/LTR dashboard while preserving the Phase 1 Safety and `MISSING` contracts.
