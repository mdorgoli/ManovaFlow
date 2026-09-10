# Existing main dashboard: persisted public-research integration

Date: 2026-09-06, Asia/Tehran

Scope: ManovaFlow only. Continue the already-designed dark, three-lane dashboard. No redesign, Academy/AgentSite changes, computer power action, deployment, paid integration or new discovery run.

## Delivered and verified

The existing main page at http://127.0.0.1:3105/ now renders the persisted public-source research snapshot. The old synthetic-only boundary previously returned HTTP 503. The read model now explicitly supports public research without calling it synthetic or bypassing the safety boundary.

- Main envelope: `manovaflow.dashboard.v2`. Safety context and safe audit sections are v2; unchanged lane, cap, ranking and evidence sections retain their existing versions.
- The API chooses the dataset from the recorded snapshot and then validates its scope. Every company, draft and shortlisted company must match that scope. Public company sources must use an allowed public provenance kind and a safe HTTPS URL. Unknown sources, warm referrals, mixed synthetic/public records and cross-tenant records still fail closed.
- Existing outbound, spending, cap, timestamp, audit-integrity and role checks remain enforced. Unknown audit events are still rejected; `MARKET_SCOUT_ACTIVITY_SNAPSHOT` is now a recognized, metadata-only event.
- The original lane cards, market ranking, evidence matrix, colors and layout are retained. Added snapshot storage/time context, an explicit public-research label, a native link to `/market-scout`, and a recorded-operations list.
- The activity list shows seven saved events in descending sequence. It does not claim that a completed run means an agent is currently working. A VIEWER receives health information without event details. Raw audit details, entity identifiers, contact records and secrets are not projected.
- The link was clicked in the actual browser and opened the existing three website-review evidence panels. No search/start/send action was triggered.

## Current record, not a new marketing result

Live check at `2026-09-06T02:03:36.890Z`:

- `/api/dashboard`: HTTP 200, PUBLIC_RESEARCH, POSTGRESQL, outbound disabled with zero actions/side effects.
- ServiceFlow's recorded scoring stage still reports two reviewed organizations/URLs, zero eligible shortlisted companies and zero drafts. Its stop reason is DIMINISHING_RETURNS.
- BeautyFlow and BriefFlow have completed zero-candidate reports, not proof of independent live research in those lanes.
- Market ranking numbers come from the recorded market-score stage. They do not prove new research in every listed country.
- The detailed activity feed still contains three website reviews from the earlier bounded run. Those review counts and the scoring-stage counts are intentionally distinguished in the dashboard copy.
- Missing elapsed-time observations remain MISSING, not zero or an invented duration. Public page signals are not confirmed customer need, interest or revenue.

## Evidence that existing results were preserved

GET `/api/market-scout/activity` returned HTTP 200. Its JSON serialization remained exactly equal to `artifacts/scout-postgres-2026-09-06/activity-before-restart.json`.

SHA-256 of JSON.stringify(parsed feed), before and after:

`6055afd5e44dc0480099c3e42954abc2accd185f6ededd66d3123a344c882db1`

There was no POST, migration, application-data rewrite, company import, new discovery request, contact reveal, message or paid action in this dashboard slice. Database test fixtures were written only to the pre-existing isolated local acceptance database under its restricted login; the suite explicitly refuses the application database.

## Fresh verification

- Regression RED: five expected unit/route failures reproduced rejection of public records, rejection of the activity audit event and the old v1 envelope. After the contract correction, 27 scoped unit tests passed.
- Component RED: three expected failures covered missing public Safety Context, the absent recorded-operations list and the absent restricted-role notice. After implementation, 43 scoped component/unit tests passed.
- Complete non-database suite: **50 files / 344 tests passed**, exit 0, start 05:27:06 local.
- Restricted PostgreSQL suite: **1 file / 9 tests passed**, exit 0, start 05:27:52 local.
- TypeScript `--noEmit --incremental false`: exit 0.
- Full-project ESLint: exit 0.
- Actual browser: desktop 1280x900 (client/scroll widths 1265/1265) and mobile 390x844 (client/scroll widths 375/375). Main dashboard, saved audit events, existing three-lane layout and evidence link were inspected. Temporary viewport override was reset.
- Mobile analysis tables retain their existing internal horizontal scroll: market table 480 px, evidence table 720 px, within a 354 px container. The overall page does not overflow. A mobile card-table redesign was not performed.

Commands:

```powershell
node node_modules/vitest/vitest.mjs run
node --env-file=.env.test.local node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts tests/integration/scout-storage.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js .
```

Vitest required the existing approved child-process exception because the sandbox blocked esbuild/Vite process spawning. That initial EPERM was an execution-environment error, not an application assertion failure.

Actual browser captures:

- `artifacts/dashboard-public-2026-09-06/desktop-top.png`
- `artifacts/dashboard-public-2026-09-06/desktop-audit.png`
- `artifacts/dashboard-public-2026-09-06/mobile-top.png`
- `artifacts/dashboard-public-2026-09-06/mobile-audit.png`

These are captures of the running local application, not generated design mockups.

## Remaining boundaries / next acceptance scope

- The main dashboard remains English/LTR; the existing Market Scout page has its separate language selector. This slice does not claim three-language main-dashboard acceptance.
- This page reads a snapshot on load; it is not a live autonomous-agent animation or worker controller. The audit list is bounded; when more events exist, the page discloses that earlier history is not displayed. An interactive history-paging control is not included.
- Mixed synthetic/public history is intentionally rejected rather than relabeled. A future mixed-dataset view needs a separate, provenance-preserving contract.
- Four autonomous marketing roles, enforceable legal-risk supervision, production identity, paid search, outreach and full customer-acquisition workflow are not delivered here.
- Full legacy administrator-based database suites, a production build/deployment and machine-reboot recovery were not run or claimed. The existing local Next preview and PostgreSQL runtime were left running.
- This acceptance supersedes only the old-dashboard-503 boundary in `2026-09-06-postgres-scout-acceptance.md`; that report's other limitations remain applicable.
