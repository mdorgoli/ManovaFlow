# SF-DEMO-1B Live Execution Entrypoint

**Status:** Implemented and statically verified; live execution not yet triggered  
**Date:** 2026-09-05  
**Scope:** Central Paris, France; ServiceFlow only

## Context

The earlier CLI used `InMemoryGrowthRepository` in a short-lived process. Its real network result
could not be read by the application panel after that process exited. At inspection time,
`DATABASE_URL` was not configured in this worker process and no ManovaFlow development server was
listening locally. Running another standalone process would therefore reproduce the same ephemeral
result and would not satisfy the panel handoff.

## Decision

Use a bounded POST command on the existing activity resource. The command executes inside the
running ManovaFlow server and receives the same repository instance used by the existing GET route.

```http
POST /api/market-scout/activity
Content-Type: application/json
Idempotency-Key: sf-demo-1b-live-pilot-v1

{"scope":"SF-DEMO-1B"}
```

The only accepted server-side scope is:

```json
{
  "id": "SF-DEMO-1B",
  "countryCode": "FR",
  "laneKey": "serviceflow"
}
```

Successful first execution returns HTTP 201 and `disposition: "CREATED"`. A repeated or concurrent
command returns HTTP 200 and `disposition: "REUSED"` without a second network execution. Both
responses contain the versioned activity snapshot. The panel continues to read it through:

```http
GET /api/market-scout/activity
```

## Authorization and safety

- The existing request-session resolver supplies tenant and actor identity.
- `authorizeResearchRun` requires `RUN_RESEARCH`, rejects client-controlled identity headers, and
  requires the fixed idempotency header.
- The command is disabled when `NODE_ENV=production`; it is explicitly a local demo entrypoint.
- Request payload validation is strict and rejects any different market, country, or lane.
- Existing tenant-scoped repository and audit behavior remains the persistence boundary.
- Same-tenant concurrent requests are coalesced in the server process.
- Responses use `Cache-Control: private, no-store`.

## Network budget

- One Overpass POST request.
- At most three accepted public organization websites.
- At most four HTTP requests per website, including redirects and `robots.txt` handling.
- Maximum total HTTP request count: 13.
- Source time budget: 5 seconds.
- Per-website time budget: 8 seconds.
- Source response limit: 512,000 bytes.
- Per-website response limit: 256,000 bytes.
- Requests are sequential for this one-worker scope.
- Paid spend, Apollo credits, messages, forms, contact reveals, and outbound actions remain zero.

## Persistence semantics

- In `MEMORY_DEMO`, the snapshot is visible to the panel for the lifetime of the same ManovaFlow
  server process only.
- With a configured shared PostgreSQL repository, the existing audit table provides persistence
  across server restarts.
- No historical, seed, or fabricated snapshot is inserted.

## Live status

No external Market Scout request was executed during this step. Local inspection found no running
ManovaFlow server to own the shared repository. A different application was listening on port 3100,
so it was not touched. The live command must be invoked once against the QA-owned ManovaFlow server;
this worker did not start, stop, rebuild, or replace that server.

## Verification evidence

- TDD RED confirmed the POST handler was absent before implementation.
- TDD RED confirmed that removing concurrent coalescing produces two network calls.
- TDD RED confirmed that removing the fixed idempotency check permits an unauthorized run key.
- Focused Market Scout, auth, endpoint, and panel suite: 14 files, 68 tests passed.
- TypeScript `--noEmit`: passed.
- ESLint on the affected backend, tests, and panel boundary: passed.
- No build or development-server command was run.

