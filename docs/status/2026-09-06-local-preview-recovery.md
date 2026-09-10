# Local preview recovery after the evidence handoff

Date: 2026-09-06, Asia/Tehran

## Current state

- The website-review evidence implementation is complete within the scoped slice described in `2026-09-05-market-scout-lead-evidence-handoff.md`.
- At approximately 02:10, both local preview URLs were unavailable. The earlier QA process was no longer serving port 3105. Its in-memory historical run must not be described as still present.
- Root started a new loopback-only development preview at `http://127.0.0.1:3105/market-scout`, using installed Next.js and the documented synthetic identity from `.env.example`. No environment file was created or modified; demo settings were process-local. No database was configured.
- Command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3105`.
- Running Codex exec session: `80576`. The first sandbox attempt failed at child-process startup with `spawn EPERM`; the approved process-permission retry started successfully. No product-code fix was required.
- Read-only GET returned HTTP 200 with `cache-control: private, no-store`, feed version `manovaflow.market-scout.activity-feed.v2`, `state: EMPTY`, `snapshot: null`, and `websiteReviewEvidence: null`.
- The previous run and its four events remain historical evidence in the earlier reports, not current panel data. No activity was seeded, backfilled, or reconstructed from those reports.

## Fresh verification

- A real in-app browser tab showed the empty state in English, French, and Arabic. Arabic's main element reported `dir="rtl"`.
- Manual refresh retained the empty state. Captured warning/error logs were empty. The tab was returned to English and retained as a deliverable.
- The same ten focused Vitest files passed again: 53 tests, exit 0, start time 02:19:37 local.
- `tsc --noEmit --incremental false` exited 0.
- Scoped installed ESLint on the implementation and test files exited 0.
- No new production build or real-network review was run. READY-detail verification remains contract, persistence, read-model, route, and component-test evidence, not a newly populated browser run.

## Other requested preview

The existing Academy owner restarted only the already verified build in `D:/ManovaMusicAcademy/.worktrees/manova-visual-home`, without rebuilding or editing product files. Build ID: `8vi5gWGruyP2luD77V29H`; owner session: `25942`; owner-reported listener PID: `50676`. Root independently confirmed HTTP 200 from `http://127.0.0.1:3111/`. The three approved posters replace the old home-page program cards as documented in the Academy handoff.

## Boundaries

Both local previews were left running. No POST, external research, paid API, contact reveal, message, form submission, deployment, package installation, production-data change, or new feature was performed during recovery. In-memory demo data is still not durable across a process restart. Durable storage and a fresh explicitly bounded real-run acceptance remain separate follow-up work.
