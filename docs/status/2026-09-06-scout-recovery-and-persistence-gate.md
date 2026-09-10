# ManovaFlow: recovery guard and durable-storage gate

Date: 2026-09-06, Asia/Tehran
Scope: ManovaFlow only. No Academy or AgentSite work was resumed.

## Delivered

`SfDemo1BExecutor` now fails closed if its fixed-key stored run exists without its final activity snapshot. Previously it could perform discovery again and write new activity for an existing RUNNING or FAILED run; a COMPLETED run with an incomplete summary also reached discovery before failing. This is unsafe recovery behavior, not permission to retry external work.

The new guard preserves the existing stored state and raises the existing sanitized execution error. The existing route maps that error to HTTP 503. A valid complete snapshot still replays through a fresh executor without another discovery.

Changed product file:

- `src/modules/growth/application/sf-demo-1b-execution.ts`

Added regression tests:

- `tests/unit/sf-demo-1b-recovery.test.ts`
- RUNNING, COMPLETED, and FAILED records without activity: zero source calls and no repository changes.
- Complete snapshot: a new executor returns REUSED and the original snapshot without additional source calls or writes.

## Verification

- RED at 02:45:35: four tests, three expected failures demonstrating unsafe replay. Tests use the real in-memory repository and deterministic source doubles; no external request is made.
- GREEN at 02:46:25: three focused files, 12 tests passed.
- Final non-database suite at 02:48:10: 47 files, 318 tests passed, exit 0.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: exit 0.
- Installed ESLint on the two changed files: exit 0.
- No production build, PostgreSQL integration test, new live research run, or deployment was performed.

## Storage inspection and permission boundary

Read-only checks found PostgreSQL 14 in Ubuntu-22.04 at localhost:5432, with an existing `manovaflow` database. Existing group roles `manovaflow_app` and `manovaflow_identity_runtime` are non-login, non-superuser, and NOBYPASSRLS. Docker's daemon was unavailable; no Docker engine or containers were started.

The attempted provisioning command would have created separate local and test databases, a restricted application login, and a privileged test-administration login. The permission reviewer rejected the command before execution because these are persistent database and security changes requiring explicit user authorization. No database, role, grant, password change, or environment file was created. Generated credential values were not displayed and were discarded from temporary orchestration state.

Do not retry the rejected provisioning indirectly, reset existing passwords, modify the existing database, or weaken authentication. The narrower proposal for user approval is separate local application/test databases with restricted runtime accounts, using the existing administrator only for the explicitly authorized provisioning/migration operation. Do not create another SUPERUSER login by default.

## Pending acceptance

- Durable storage is NOT enabled; the current preview still uses MEMORY_DEMO.
- A migration gap was found by source inspection: the current candidate schema accepts OPEN_DATASET, while migration 0001's companies.source_kind check does not. A real isolated PostgreSQL regression must demonstrate this before implementing a migration fix. No SQL migration was changed in this slice.
- After explicit provisioning approval, verify database writes/reads, tenant isolation, evidence retention through a new database connection, and same-key replay before a bounded real-network acceptance.
- This guard handles an already recorded run. It does not claim a cross-process atomic admission guarantee for a crash before any run row is written; that boundary must be addressed and tested before multi-process execution is enabled.
- No shutdown, sleep, reboot, or stop command was issued for the laptop or the running ManovaFlow preview.
