# Market Scout activity panel integration

Date: 2026-09-05

## Delivered

- `/market-scout` renders the activity panel and reads `GET /api/market-scout/activity` using the existing same-origin session. Reads do not initiate research.
- The client uses the producer's `MarketScoutActivityFeed` type via a type-only import. The server page passes the producer's feed-version constant; no repository/read-model implementation is imported into the client. Snapshot validation reuses the existing pure snapshot parser.
- EMPTY displays no recorded activity. Loading, retryable error, recorded status, timestamps, market, lane, SEARCH/SEED origin, actual filter and ordered event details are visible. Data is cleared on failed refresh because session/tenant authorization may have changed.
- Initial history and different runs do not animate. Only additional events from the same run that occurred within the producer's freshness window can receive one finite highlight. Idle, stale and error states do not animate; reduced-motion disables the highlight.
- RUNNING snapshots older than `staleAfterMs` show an explicit stale warning. Completed history is labelled as recorded, and no current website operation is invented from completed events.
- English, French and Arabic labels are available, with Arabic RTL and bidirectional isolation for recorded values. Producer evidence remains verbatim.
- Refresh is manual. A local clock only updates freshness; it does not poll or simulate activity. AbortController cleanup and request generations prevent late/aborted responses from replacing current data.

## Files

- `src/app/market-scout/page.tsx`
- `src/components/market-scout/activity-feed.tsx`
- `src/components/market-scout/activity-panel.tsx`
- `src/components/market-scout/activity-copy.ts`
- `src/components/market-scout/activity-panel.module.css`
- `tests/component/market-scout-activity-feed.test.tsx`
- `tests/component/market-scout-activity-panel.test.tsx`

## Verification

- Dedicated component and transport tests: 2 files, 11 tests passed.
- TypeScript `--noEmit --incremental false`: passed.
- Scoped ESLint: passed. One documented rule exception marks an effect-started async network loader whose state updates occur on response/failure; loading state is initialized or set by the refresh interaction.
- Tests cover EMPTY, loading, error and retry, invalid response rejection, same-origin no-store reads, cleanup cancellation, ignored stale responses, first-history/no-animation, new-event highlight, seed distinction, stale running, completed history and language/RTL switching.

## Remaining verification and boundaries

Browser, production build and runtime acceptance were not run in this subtask. The endpoint may truthfully remain EMPTY because earlier CLI runs used ephemeral repositories. No synthetic data was added to the route and no new real research was launched. No entry link in existing navigation was added; that remains a coordinated integration choice. No growth, ServiceFlow, package, global-style or shared-configuration file was edited.
