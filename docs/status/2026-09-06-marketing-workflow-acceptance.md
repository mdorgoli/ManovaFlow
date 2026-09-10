# Recorded marketing workflow — local acceptance, 2026-09-06

## Delivered

The existing activity endpoint now returns envelope `manovaflow.market-scout.activity-feed.v3`, with a tenant-scoped `marketingPipeline` projection. The saved activity v1 and website-review-evidence v1 records are unchanged. The existing operations dashboard links to `/market-scout#marketing-workflow`; the fragment lands after asynchronous data loading, without repeated scrolling on language changes.

The four roles are implemented as deterministic software stages over saved records:

1. Prospector normalizes recorded public sources and allowlisted review facts.
2. Qualifier binds the company, review, completed run, score explanation and chronology; applies the unchanged ServiceFlow threshold of 60 and suppression/risk checks.
3. Pitcher produces three source-bound internal template previews only for eligible records. The preview is derived, not persisted. No recipient field or send action exists.
4. Supervisor validates the structured template, source and permitted claims. All external actions remain blocked, including qualified cases. Legal review and customer-need verification remain human tasks.

Every stage checks its allowed operation and a zero-external-request, zero-spend, zero-outbound budget. These checks govern this projection only: they do not replace the older `run-lane` execution path or constitute a global legal agent.

## Actual saved-data result

Run: `01fe0796-f324-44de-9a28-b0eb8b97fa0e`. Recorded snapshot: `2026-09-06T00:14:23.971Z`.

| Source domain | Recorded score | Qualification | Internal previews |
|---|---|---|---|
| comptoirdesserruriers.fr | 45 / 60 | Below threshold | 0 |
| barazzetti-fils.fr | 45 / 60 | Below threshold | 0 |
| anil-electricite.fr | Not recorded | Not scored in this run | 0 |

Three reviewed sources, zero fit-qualified prospects, zero previews. These are historical public-source research records, not customers, verified needs or live agent activity. Matching chronology does not imply evidence freshness today or introduce an expiration policy.

GET against the running local application returned HTTP 200. Deep equality against `artifacts/scout-postgres-2026-09-06/activity-before-restart.json` confirmed unchanged `snapshot` and `websiteReviewEvidence`. SHA-256 of `JSON.stringify({snapshot,websiteReviewEvidence})` is `d4ad61555a5c14a6db4698a0f44cb4c4f7a843b39bf0b1484c1ea9f156edbe68`. The dashboard still exposes seven recorded audit events. No application-database mutation, discovery rerun, external-site request, paid call, message, reveal, deployment or server shutdown was performed in this slice.

## Verification

- `node node_modules/vitest/vitest.mjs run --maxWorkers=4`: **53 files / 383 tests passed**. Includes 39 new workflow tests and an extended dashboard-link assertion.
- `node --env-file=.env.test.local node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts tests/integration/scout-storage.test.ts --maxWorkers=1`: **9 tests passed**, using the isolated restricted PostgreSQL test database, not application storage.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passed.
- `node node_modules/eslint/bin/eslint.js .`: passed.
- Negative cases cover cross-tenant data, viewer access, mismatched run/country/source domain, invalid scores, suppression, instruction-contaminated evidence, forged send permissions, template/claim tampering and nonzero action budgets.
- Positive qualification and EN/FR/AR preview generation were tested with offline fixtures only; no fixture was inserted into the actual application database.
- Browser checks used the actual local endpoint: EN/FR/AR, Arabic RTL, desktop viewport 1422 × 986 and mobile 390 × 844. Measured document widths were 1407 and 375 respectively (scrollbar excluded), equal to scroll widths. No horizontal document overflow. Native navigation landed at a 20 px workflow offset after loading.

Browser evidence is under `artifacts/marketing-workflow-2026-09-06/`: `desktop-en.png`, `desktop-fr.png`, `desktop-ar.png`, `mobile-en-record.png`, `mobile-fr-record.png`, `mobile-ar-steps.png`, `mobile-ar-record.png`. An initial mobile French capture was replaced after verifying a dedicated QA tab, because the shared preview changed state during inspection.

No production build, deployment, autonomous/LLM agent run, live positive lead or outgoing communication is claimed.

## Public homepage and logo clarification

The owner re-supplied the light public-homepage reference `exec-395f44fa-ca20-457e-8d9a-a2ff36bcf6ab.png` and the MF symbol. The existing `docs/design/2026-09-04-manovaflow-public-site-engineering-handoff.md` points to that exact homepage reference; `docs/design/brand-assets/README.md` documents the separate MF web assets. The thin loop in the generated homepage image is not the selected MF mark.

No homepage redesign or asset modification was made here. Currently `src/app/page.tsx` still renders `GrowthDashboard` at `/`; that is the internal operations console, not an implementation of the approved light public page. The handoff's public-image/font/icon and release dependencies are not silently treated as resolved. The next public-page work must preserve this reference and keep internal operations separate.
