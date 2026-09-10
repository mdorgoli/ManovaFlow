# Resume plan: visible Market Scout acceptance

Date: 2026-09-05
Status: COMPLETE — bounded recorded-run acceptance, not production or autonomous-sales acceptance
Authority: The user requested continuation of ManovaFlow after restarting the computer. Other projects remain paused.

## Binding scope

- Continue the already authorized local, no-cost, public-data pilot in Central Paris: FR and serviceflow only.
- No paid API, new subscription, contact reveal, message, contact form, external write, deployment, hosting change, or market expansion.
- Use the existing server-side demo identity and the existing shared repository. Never inject identity from browser headers, bypass authorization, seed companies, or manufacture activity.
- Research execution is explicit. Opening or refreshing the panel must never launch research.
- The existing command is development-only. In-memory results last only as long as that server process; do not claim durable PostgreSQL persistence or production readiness.
- The newly discussed four-role marketing architecture and supervisory legal-risk gate are not implementation scope for this acceptance batch.

## Evidence and workspace

- Exact workspace: D:/ManovaFlow. Read-only git status confirms this directory is not a Git repository. Preserve all existing files; no Git initialization, reset, clean, stash, branch, or merge.
- Producer specification/report: docs/status/2026-09-05-sf-demo-1b-live-execution-entrypoint.md.
- Consumer specification/report: docs/status/2026-09-05-market-scout-activity-panel-integration.md.
- Previous browser evidence: docs/status/2026-09-05-market-scout-browser-acceptance.md. It covered EMPTY and 503/retry, not a populated real run.

## Task boundaries and consistency review

| Task or interface | Producer / consumer agreement | Decision |
| --- | --- | --- |
| Existing POST to GET | Both resolve the same server-side actor and growth repository; POST records an activity audit snapshot | Accept only same-tenant, matching run ID in the actual HTTP responses |
| GET to panel | Versioned feed EMPTY or READY; panel labels historical results as recorded | No automatic live/streaming claim |
| Real execution QA | Fixed command, maximum 13 public HTTP requests, at most 3 organizations, no outbound | One explicit command, then one identical idempotency replay; replay must not launch another run |
| Browser and build | Next development and build share generated output | QA exclusively owns test/build/server sequencing; no parallel build or source edits during runtime acceptance |

Ruling: Reuse the existing non-Git workspace and existing executor report as the review baseline. The cost is that no commit-based diff or automatic rollback can be claimed; no unrelated files may be changed.
Ruling: This batch proves a bounded recorded result in the panel, not four autonomous model agents or a production lead-generation service. Those remain distinct future acceptance scopes.

## Tasks

1. Review the current command boundary and run local verification before any network execution. Owner: demo_browser_qa; root reviews source and final evidence independently.
2. Start a QA-owned loopback-only development server. Run the documented command once, then compare the POST result, GET feed and actual browser panel. Preserve EMPTY/failure honestly if the source fails.
3. Check EN/FR/AR, Arabic mobile, source links, recorded-versus-live labels, manual refresh and idempotency. Capture browser screenshots and exact limitations.
4. Hand off an accessible local URL with the server process/session identified, or report the exact blocker. Keep a successfully populated demo server running for the user unless instructed otherwise.

### Acceptance follow-up: source-link usability

The first real browser acceptance found that source URLs render as text, not links (P3). Root confirmed the `Field` rendering in `activity-panel.tsx`. Resolve this narrow acceptance defect before handoff: source URLs must be keyboard-accessible native external links with safe tab/referrer behavior and visible focus. Preserve the HTTPS contract and recorded-event semantics; no automatic external navigation, network research, API, identity, repository or layout redesign changes.

The source-link implementer owns only the panel component, its CSS and corresponding component tests, using test-first verification. QA retains ownership of the running server and browser acceptance. Focused component tests may run without writing Next build output; no further build/dev restart is permitted while preserving this in-memory result. Root will independently review the change and evidence. Other projects remain paused.

## QA brief

Read the producer and consumer reports above and relevant installed Next.js documentation before any code-related operation. Do not edit product source for this task. Do not spawn another agent. Use installed local binaries, not package-manager installation or registry fallback. Run focused tests for the command, feed and panel, then one local build while no dev server is running. If verification fails, report the precise failure without implementing an unassigned fix or triggering the real command.

Use an unused loopback port; do not terminate unknown processes. Run:

```http
POST /api/market-scout/activity
Content-Type: application/json
Idempotency-Key: sf-demo-1b-live-pilot-v1

{"scope":"SF-DEMO-1B"}
```

Preserve the existing source limits: one Overpass query, at most three organization websites, at most four HTTP requests per website, no widened geography, no new company names supplied manually. Use the existing non-production server-side demo identity; keep all authorization protections intact. Do not print secrets. Capture the actual network outcome rather than retrying in a new process or changing the key to obtain a preferred result.

Report path: docs/status/2026-09-05-market-scout-populated-browser-acceptance.md.
Artifact directory: artifacts/market-scout-populated-browser-2026-09-05/.
Return status, test/build commands and exit codes, source outcomes, run ID agreement, screenshots, server ownership, limitations, and any actionable findings. Separate genuine browser observations from unit/component-test evidence.

## Progress

- Recovered previous reports and reviewed GET/POST, fixed scope, idempotency service and pilot orchestration.
- The earlier source and component implementation tasks are not restarted.
- A single real run completed: `e554a011-273b-43dd-a2ab-a59bed50b5e2`; POST 201 CREATED, identical replay 200 REUSED and GET 200 READY match. Root independently re-read the current GET response and inspected EN and Arabic-mobile screenshots.
- Six focused files / 23 tests and one build passed per QA report. Populated EN/FR/AR/mobile acceptance is recorded in `2026-09-05-market-scout-populated-browser-acceptance.md`.
- Source-link usability follow-up: complete. Native HTTPS-only external links, safe tab/referrer attributes, visible focus and readable invalid-URL fallback were added without changing API, identity or persistence. The test-first regression and follow-up fixture correction are documented in `2026-09-05-market-scout-source-links-fix.md`.
- Independent final root verification after the fixture correction: six focused test files / 32 tests passed (17:43:36 local, exit 0); `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed (exit 0); two-file scoped ESLint passed (exit 0). The initial sandbox `spawn EPERM` was a startup restriction, not a failing test; the same installed test command ran with approved process permission. A previous genuine TS2322 fixture error was fixed with an explicit event-presence guard, without weakening production types.
- QA's final browser addendum confirms four keyboard-focusable source links, EN/FR/AR, mobile RTL and the original run. Root independently inspected desktop focus and `ar-mobile-source-focus-verified.png`; the earlier mobile focus screenshot is not used as source-focus evidence.
- Final root GET recheck: HTTP 200 / READY, original run `e554a011-273b-43dd-a2ab-a59bed50b5e2`, COMPLETED, four events. QA server session 28279 remains running at `http://127.0.0.1:3105/market-scout` for user handoff; the recorded result remains in-memory only. No additional real research or external navigation was triggered by the correction.
- Build evidence belongs to the earlier pre-link-correction verification. No new build was run alongside the retained development server; final checks are focused tests, read-only TypeScript, scoped lint and real-browser acceptance. No production-release claim is made.

## Next acceptance boundary (not delivered by this batch)

- A successful website review is not evidence of buying intent, a qualified lead, a message sent or revenue. The panel currently shows source URLs and recorded decision/reason codes, not an evidence-backed sales qualification narrative.
- The next useful product slice is a lead detail view that distinguishes observed public facts, source evidence, fit rules and unresolved assumptions. Unknown needs must stay unknown; do not turn an OSM match or HTTP success into a verified need.
- Before autonomous or external actions are enabled, the previously discussed permission/supervision boundary still requires an explicit implementation and acceptance task. Four separated agents, a legal-risk reviewer and durable persistence are not asserted here.
