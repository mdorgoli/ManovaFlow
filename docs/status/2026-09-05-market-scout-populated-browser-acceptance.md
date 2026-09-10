# Market Scout populated real-browser acceptance

## Addendum: P3 source-link closure (same server and recorded run)

The source-link P3 below is now **closed by real-browser acceptance** after the separately owned component correction. Reloaded the same tab 749642680 on server session 28279; run `e554a011-273b-43dd-a2ab-a59bed50b5e2`, four events and original timestamps remained unchanged. All four exact HTTPS source URLs now render as native anchors with accessibility role link, `target="_blank"` and `rel="noopener noreferrer"`.

Keyboard Tab navigation focused all four anchors in event order, confirmed from `document.activeElement` without pressing Enter or clicking any link. EN and FR preserved recorded labels and evidence. Arabic mobile 390×844 retained RTL and no horizontal overflow (clientWidth=scrollWidth=375). The focused first source showed a visible cyan outline (computed solid 1.6px); screenshot confirms it. Captured console warning/error list remained empty.

New evidence: `artifacts/market-scout-populated-browser-2026-09-05/en-source-links-focus.png` and `ar-mobile-source-focus.png`. No external source was visited, so destination loading is not claimed. No POST, seed, build, server restart or source edit was performed by this acceptance worker. Page reload/read and language/keyboard actions did not change the recorded run or initiate visible navigation/research. Viewport restored, English selected, tab retained as deliverable, and server remains running for the user.

Date: 2026-09-05. Result: PASS for bounded recorded-run integration; historical source-URL P3 below is resolved by the addendum.

### Evidence correction after root review

The original `ar-mobile-source-focus.png` is not accepted as evidence of source focus: root inspection found it captured Refresh instead. Desktop keyboard traversal of all four anchors was independently established by activeElement href values; that does not make the original mobile image valid. A new actual mobile capture is saved as `artifacts/market-scout-populated-browser-2026-09-05/ar-mobile-source-focus-verified.png`. The exact screenshot bytes saved were emitted and visually inspected in the same call. They show the Overpass source in the viewport with a cyan focus rectangle. At capture, activeElement href was `https://overpass-api.de/api/interpreter`, outline solid cyan 1.6px, and its bounding rectangle top 410.84 / bottom 432.44, within the 844px viewport. This supersedes the earlier mobile screenshot claim. No external navigation was performed. The addendum is near the beginning of this file and was reread from disk after editing; the earlier P3 paragraph below is retained as historical pre-fix evidence.

## Verification before execution

Installed binaries only, in D:/ManovaFlow, with approved process/network escalation. No source edited and no package installation. Focused command:

`node node_modules/vitest/vitest.mjs run tests/unit/market-scout-activity.test.ts tests/unit/market-scout-activity-route.test.ts tests/unit/market-scout-activity-read-model.test.ts tests/unit/market-scout-activity-command-route.test.ts tests/component/market-scout-activity-panel.test.tsx tests/component/market-scout-activity-feed.test.tsx`

Exit 0: 6 files, 23 tests passed. Then exactly one `node node_modules/next/dist/bin/next build`, exit 0; compile, TypeScript and page generation passed. No dev server ran during build.

## Single real execution and matching reads

QA server: Next 16.3.4 at http://127.0.0.1:3105, exec session **28279**, started around 17:22 local. Existing server-side demo OWNER identity, tenant `99999999-9999-4999-8999-999999999901`, actor ending 9902. No client identity injection.

One explicit POST `/api/market-scout/activity`, body `{"scope":"SF-DEMO-1B"}`, fixed Idempotency-Key `sf-demo-1b-live-pilot-v1`: **201 CREATED**. One identical replay: **200 REUSED**. GET: **200 READY**. All three snapshots share run ID **e554a011-273b-43dd-a2ab-a59bed50b5e2**, COMPLETED status and identical four ordered event facts/timestamps. Replay retained original finished/snapshot timestamp; no new run was produced.

Run began 2026-09-05T13:52:26.254Z and finished 13:52:38.952Z (12.698 seconds). Scope remained FR/serviceflow, SEARCH, Central Paris bbox and existing craft filter. Observed source events:

| Sequence | Source | Outcome |
| --- | --- | --- |
| 1 | https://overpass-api.de/api/interpreter | SUCCEEDED / OPEN_DATA_DISCOVERY_COMPLETED |
| 2 | https://www.comptoirdesserruriers.fr | SUCCEEDED / PUBLIC_PAGE_REVIEWED |
| 3 | https://www.barazzetti-fils.fr | SUCCEEDED / PUBLIC_PAGE_REVIEWED |
| 4 | https://www.anil-electricite.fr | SUCCEEDED / PUBLIC_PAGE_REVIEWED |

These are actual executor-recorded outcomes, not browser visits to the external websites. No new key, second process retry, manually supplied organization or fixture was used. Existing limits were retained (one Overpass query, up to three sites and four HTTP requests/site). Per-request packet counts were not independently instrumented; four events do not mean exactly four HTTP requests.

## Actual browser observations

Chrome real browser tab 749642680 displayed the same run ID, all four events, timestamps, FR/serviceflow and SEARCH filter. It explicitly says recorded events do not confirm current agent activity. Completed status remained recorded after manual Refresh activity; no invented live agent animation/status appeared. English, French and Arabic labels switched while preserving run/evidence.

Arabic mobile override 390×844: main RTL, content clientWidth=scrollWidth=375 (scrollbar accounts for remaining width), no horizontal overflow. Console captured warning/error list empty. Captured screenshots are real viewport screenshots: the initial full-page capture timed out, so viewport captures were used rather than claiming a full-page image.

Source URL finding (P3 usability): the four correct source URLs are readable text but **not clickable links**. DOM anchor inventory was empty. Reproduce by opening any recorded event and attempting keyboard/link navigation to its Website value. No source change was made in QA; this does not invalidate the recorded-run agreement but link functionality is not delivered.

Artifacts: `artifacts/market-scout-populated-browser-2026-09-05/http-outcomes.json`, `en-recorded.png`, `fr-recorded.png`, `ar-mobile-recorded.png`, `ar-mobile-events.png`.

## Handoff and limitations

The successfully populated **server remains running**, as instructed, in session 28279 at http://127.0.0.1:3105/market-scout. Browser tab marked deliverable; viewport restored and display returned to English. A final Get-NetTCPConnection inspection was denied by sandbox; no PID claim is made. The browser response and known exec session establish the handoff, not an OS process inventory.

Results are in-memory for this server lifetime; stopping/restarting may remove them. This is not durable PostgreSQL, production deployment, four autonomous agents, live streaming, or a newly running scan. Test/component coverage is separate from the actual completed browser snapshot; running/stale/failure event branches were not manufactured for this batch. No paid service, contact reveal, message, form submission, publication, auth bypass, other project change or subagent was used.
