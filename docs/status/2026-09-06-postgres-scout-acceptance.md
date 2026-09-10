# ManovaFlow: restricted local PostgreSQL and retained Scout evidence

Date: 2026-09-06, Asia/Tehran
Scope: ManovaFlow only. No Academy, AgentSite, hosting, production deployment, or computer power action.

## Delivered

The local Market Scout preview uses a dedicated PostgreSQL database. An actual bounded public-source run and its three website-review evidence records survived replacement of the Next.js process. The fixed-key replay returned REUSED, not another research run. The user explicitly approved two separate local databases and restricted accounts; no new SUPERUSER login was created.

Preview: http://127.0.0.1:3105/market-scout

### Database isolation

| Purpose | Database | Restricted login |
| --- | --- | --- |
| Local application | manovaflow_scout_local | manovaflow_scout_runtime |
| Acceptance tests | manovaflow_scout_test | manovaflow_scout_test_runtime |

- Both databases are owned by the existing postgres administrator; runtime logins are not owners.
- Both logins are NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION, NOBYPASSRLS.
- Neither login is a member of the pre-existing manovaflow_app or identity roles. Its grants exist only on its own database's application tables; membership/tenant tables are read-only, audit/compliance tables are append-only, and identity credentials are inaccessible.
- PUBLIC database privileges were revoked only on the two new databases. Each login has CONNECT on its own database. The test login's CONNECT privilege on the application database was verified false.
- A read-only privilege check in the existing manovaflow database found zero public-schema tables accessible to either new login. No DDL/DML was applied to that existing database.
- Existing PostgreSQL cluster roles were reused only by the administrator during the existing migrations. No privileged credentials were issued to the application/tests.
- Credentials are in ignored .env.local and .env.test.local, are server-only, and are not included in this report or artifacts. Never upload these files.
- Only demo tenant/membership identities were provisioned in the new application database. No companies or historic activity were seeded or backfilled there. Fictional schema test records remain solely in the isolated test database.

### Code corrections

1. A validated DATABASE_APPLICATION_ROLE setting lets the growth repository and membership lookup use their scoped login instead of requiring membership of the old shared application role. SQL identifiers are quoted with the driver's identifier helper. Invalid role names fail before opening a connection. The default remains manovaflow_app for existing configurations.
2. Migration 0004_growth_open_dataset_source.sql adds OPEN_DATASET to the database source-kind allowlist. Other unknown kinds still fail the constraint. Migration 0001 was not rewritten; the new migration is registered in the migration runner and was applied atomically to both new databases.
3. Completed-run summaries now write a JSONB object using the driver's JSON helper and decode legacy JSON-string summaries on read. Existing history was not rewritten. This fixes the object-versus-string replay contract exposed by real PostgreSQL testing.
4. The migration CLI success message no longer falsely claims only migrations 0001–0002 ran.

## Real bounded execution and persistence proof

- One explicit POST with scope SF-DEMO-1B and key sf-demo-1b-live-pilot-v1.
- Scope remained FR / serviceflow / existing Central Paris bounding box. No paid API, contact reveal, message, form submission, or outbound sales action.
- Run ID: 01fe0796-f324-44de-9a28-b0eb8b97fa0e.
- Started: 2026-09-06T00:14:05.532Z; finished: 2026-09-06T00:14:23.971Z.
- POST: HTTP 201 / CREATED. One discovery event and three successful website-review events.
- Source discovery used one bounded Overpass query; each website review recorded two HTTP requests. Recorded total: seven public HTTP requests, within the authorized maximum of thirteen.
- Source websites: comptoirdesserruriers.fr, barazzetti-fils.fr, anil-electricite.fr. The stored evidence is allowlisted keyword signals, not proof of need, ownership, buyer authority, or interest.
- After replacing the Next process, GET returned HTTP 200 / READY with the same run ID and byte-equivalent JSON serialization of the feed. An identical POST then returned HTTP 200 / REUSED; feed content remained identical afterward.
- After the final summary correction and another preview process replacement, a final read still matched the original complete feed exactly. No additional discovery command was issued.
- Seven audit events and one activity snapshot remain stored. Three lane-report rows exist because the current coordinator writes reports for all lanes; only serviceflow had the scoped discovery candidates. This is not evidence that the other lanes performed network research.

### Counts are not interchangeable

The website-review stage examined three discovered sites. The scoring stage stopped after two below-threshold candidates under its existing DIMINISHING_RETURNS rule. Therefore the application database has **two company rows, zero eligible shortlisted companies, and zero persisted drafts**, while the activity evidence contains all three site reviews. No confirmed customer or revenue is claimed. Do not invent a third company row, retroactively change the run, or relax the threshold to make the count look better.

## Fresh verification

- Restricted database integration RED: four failures from attempting the old shared role. The other three database-boundary checks already passed.
- Source-kind RED: companies_source_kind_check rejected OPEN_DATASET; after migration the seven tests passed.
- Summary RED at 04:03:03: two tests reproduced string summaries where structured objects were required.
- PostgreSQL GREEN at 04:04:25: nine tests passed using the restricted test login, including current/legacy summaries, source-kind constraints, persistence across a new pool, tenant RLS, membership, and audit tamper prevention.
- Final non-database suite at 04:11:36: 48 files / 324 tests passed, exit 0.
- TypeScript with --noEmit --incremental false: exit 0.
- ESLint on all changed TypeScript files and the migration CLI: exit 0.
- Browser: actual persisted run shown in EN/FR/AR; three evidence panels; four native source links; manual Refresh kept the same record; no console warnings/errors in the final check. Arabic main dir=rtl. Requested mobile viewport 390×844, measured content/client width 375 CSS px (scrollbar excluded), no horizontal overflow. Temporary viewport override was reset and English restored.
- No full legacy admin-based integration suite or production build was claimed or run in this slice. The scoped suite deliberately refuses any database/login other than the isolated local acceptance target.

Commands:

```powershell
node --env-file=.env.test.local node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts tests/integration/scout-storage.test.ts
node node_modules/vitest/vitest.mjs run --exclude tests/integration/**
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

## Artifacts

- artifacts/scout-postgres-2026-09-06/activity-before-restart.json
- artifacts/scout-postgres-2026-09-06/restart-acceptance.json
- artifacts/scout-postgres-2026-09-06/en-desktop.png
- artifacts/scout-postgres-2026-09-06/ar-mobile.png

The screenshots are actual browser captures, not design mockups. Public website text was treated as data; no page instructions were executed.

## Runtime / restart notes

- PostgreSQL 14 main runs in the existing Ubuntu-22.04 WSL distribution, listening only on localhost:5432. No public network binding, firewall change, Docker engine, or global WSL setting was introduced.
- The first Windows connection failed because no WSL distribution remained running after the short admin commands ended. An owned WSL keep-alive process resolved this; the same tests then reached the real database and exposed the expected role/schema defects. The original ECONNREFUSED was an environment startup failure, not a test assertion failure.
- WSL keep-alive exec session: 56866. Final Next preview exec session: 53196. Leave them running for the user's local preview; do not stop unrelated processes.
- For a future manual local start, keep Ubuntu-22.04 running (for example, keep a terminal running `wsl --distribution Ubuntu-22.04 --exec /bin/sleep infinity`), then from D:/ManovaFlow run `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3105` in another terminal. Next loads the local environment file. This is not an installed auto-start service.
- Runtime credentials intentionally cannot perform migrations or provision membership. Do not grant admin rights merely to make a migration/test command succeed; use a separately authorized administrator against the exact intended database.

## Remaining boundaries

- The old phase-1 /api/dashboard contract deliberately accepts synthetic data only. It currently returns 503 DASHBOARD_UNAVAILABLE when presented with these real public company records. The Market Scout page/API work; the old dashboard is **not** claimed fixed. Next product task: explicitly support public research provenance in that dashboard without relabeling public data synthetic or weakening outbound controls.
- Discovery count, scoring stop reason, stored companies, and review evidence still need clearer reconciliation in the user-facing lead view.
- The existing recorded-run recovery guard blocks retry when a fixed-key run lacks its snapshot. Cross-process atomic admission *before any run row exists* is not implemented; do not enable concurrent multiprocess execution or automatic retries.
- The ServiceFlow demo repository remains in-memory; this slice changes growth/Market Scout storage, not every module's persistence.
- No database backup/restore or machine-reboot recovery acceptance was performed. Verified restart recovery covers fresh application processes against the same persistent local PostgreSQL data.
- Four autonomous marketing agents, legal-risk supervision enforcement, production identity, paid integrations, autonomous outreach, and production deployment are separate acceptance scopes and are not delivered by this change.
