# Market Scout Activity Endpoint — SF-DEMO-1B

Date: 2026-09-05  
Scope: Market Scout activity read path only

## Delivered contract

`GET /api/market-scout/activity`

The route returns one of these versioned responses:

```json
{
  "contractVersion": "manovaflow.market-scout.activity-feed.v1",
  "state": "EMPTY",
  "snapshot": null
}
```

```json
{
  "contractVersion": "manovaflow.market-scout.activity-feed.v1",
  "state": "READY",
  "snapshot": {
    "contractVersion": "manovaflow.market-scout.activity.v1"
  }
}
```

The full snapshot type is exported as `MarketScoutActivitySnapshotV1` from
`src/modules/growth/application/market-scout-activity.ts`.

## Data and security behavior

- Authentication is resolved from the existing server-side request session.
- Dashboard read authorization is required; client-controlled identity headers are rejected.
- Tenant identity is never accepted from a query string or request payload.
- The read model fails closed if a repository response contains any cross-tenant audit row.
- Snapshot payloads are strictly validated before being returned.
- Responses use `Cache-Control: private, no-store`, including handled errors.
- The GET route performs no source discovery, website review, or other external network request.
- A completed live pilot appends its real activity snapshot to the existing tenant-scoped audit log.

## Truthful empty state

Earlier standalone CLI pilot processes used an ephemeral in-memory repository and did not leave a
snapshot that this application process can recover. The endpoint therefore returns `EMPTY` until a
real run is persisted through a repository shared with the application. No seed, fabricated event,
or synthetic fallback is emitted, and this endpoint does not claim a live connection.

## Boundaries preserved

- No paid API, Apollo credit, contact reveal, purchase, message, form submission, or outbound action.
- No ServiceFlow module change.
- No package, lockfile, global configuration, deployment, build, or development-server action.
- No market expansion.

## Verification

- Dedicated endpoint/read-model/persistence tests: passed.
- Market Scout plus auth regression suite: 11 files, 52 tests passed.
- TypeScript `--noEmit`: passed.
- ESLint on the changed implementation and test files: passed.

