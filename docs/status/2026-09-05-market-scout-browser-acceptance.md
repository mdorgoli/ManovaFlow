# Market Scout real-browser acceptance — 2026-09-05

## Outcome

PASS for the observable EMPTY/read-only refresh/localization/mobile/error scope. No recorded run existed, so running/completed event presentation, event animation, timestamps, filters, lane and SEARCH/SEED rendering were **not browser-verified**. No fixture was injected and no discovery/research was started to manufacture those states.

Read the integration report and `src/app/api/market-scout/activity/route.ts` before testing. The endpoint resolves the existing actor, authorizes dashboard access, reads the tenant dashboard and builds its activity feed, with private/no-store responses. This is source inspection; runtime observations are below.

## Real browser and server evidence

Chrome extension-controlled real browser; temporary QA tab at `http://127.0.0.1:3105/market-scout`. Installed Next.js 16.3.4 development server. First QA session 44689 used the existing server-side DEMO OWNER context with synthetic tenant ending 9901. No identity was injected into requests and no data was seeded.

- Initial loading rendered “Refreshing activity…” with disabled refresh, then truthful “No recorded activity / No agent events are available for this run.”
- Manual Refresh activity returned to the same EMPTY state. Server output contained exactly the initial and manual `GET /api/market-scout/activity` requests, both 200. No POST or research invocation was observed. No ongoing agent activity or invented history was displayed.
- English, French and Arabic headings, empty-state copy, language selector and refresh control changed correctly.
- Arabic mobile viewport 390×844 displayed main `lang=ar`, `dir=rtl`, with `scrollWidth=clientWidth=390`; visual screenshot showed right-to-left layout and no horizontal overflow.
- Browser captured error/warning logs were empty during the normal EMPTY path.

For the unavailable-authentication path, only the QA server was stopped and restarted as session 7105 with DEMO_MODE=false. The default auth implementation is fail-closed when demo authentication is off; no auth protection was weakened. The UI reloaded on the development-server restart and showed “Activity unavailable / The activity record could not be loaded. Agent status is unknown.” Actual endpoint requests returned 503 (initial plus manual retry), not 401. Therefore this verifies the configured auth-service-unavailable path, **not an ordinary expired-cookie/401 login flow**. The retry control remained usable; French and Arabic unavailable copy rendered correctly without displaying fabricated data. Captured browser error/warn logs remained empty despite the server-recorded 503 responses.

The restart reloaded the page and English became the default again. This is not a claim that an in-place failed refresh cleared existing recorded events: there were none. Populated-feed authorization changes, stale responses and invalid payload branches remain component-test evidence from the integration report, not this real-browser run.

## Artifacts

Saved under `artifacts/market-scout-browser-2026-09-05/`:

- `en-empty.png`
- `fr-empty.png`
- `ar-mobile-empty.png`
- `en-unavailable.png`
- `fr-unavailable.png`
- `ar-mobile-unavailable.png`

## Findings and boundaries

No blocking UI defect was observed in this tested scope. The generic browser document title remains “ManovaFlow · Growth Control” rather than Market Scout; noted as metadata polish, not a blocking acceptance failure.

No product source, test, package or shared configuration changed. No global build or component test was run by this QA worker. No installation, transaction, external message, publication, other-project operation or external discovery occurred. This is a local runtime acceptance result, not production/live-feed proof.

Both QA-owned server sessions were stopped. Port 3105 had no listening entry after cleanup. Temporary viewport override was reset and the QA tab closed; no user tab or user process was closed.
