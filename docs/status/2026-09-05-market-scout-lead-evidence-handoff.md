# SF-DEMO-1B — Market Scout website-review evidence handoff

**Date:** 2026-09-05  
**Status:** Completed within the leader-approved slice  
**QA surface:** `http://127.0.0.1:3105/market-scout`

## Outcome

Future authorized Market Scout runs can persist and display a bounded, allowlisted website-review evidence bundle. The existing historical QA run remains unchanged and is explicitly labeled as evidence not recorded; no facts or counters are reconstructed for it.

The existing `manovaflow.market-scout.activity.v1` snapshot contract remains compatible. The read feed is versioned as `manovaflow.market-scout.activity-feed.v2`, and the separately validated evidence bundle is versioned as `manovaflow.market-scout.website-review-evidence.v1`.

## Evidence contract and persistence

- The evidence bundle is stored only inside the same tenant-scoped `MARKET_SCOUT_ACTIVITY_SNAPSHOT` audit row under `details.websiteReviewEvidence`.
- The bundle contains only allowlisted enums, credential-free HTTPS source URLs, canonical UTC timestamps, bounded numeric counters, a boolean instruction-like-text signal, and exact-zero safety counters.
- Raw HTML, page text, contact data, PII, prompt-like instructions, and the reviewer's free-text potential-fit reason are not persisted.
- Potential fit is derived from allowlisted observed facts and is explicitly presented as requiring human review, not as proven need or customer interest.
- Reviews with any outcome other than `SUCCEEDED` must have no observed facts and must use `NOT_ASSESSED`; malformed combinations fail closed.
- Source URLs are capped at 2,048 characters. Evidence timestamps are exactly 24-character canonical UTC ISO instants (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Each bundle is capped at three reviews. Each review is capped at four requests and 320,000 bytes. Duplicate facts, unknowns, or source/timestamp review keys are rejected.
- Read-model and client validation require exact run ID, website-review event count, source URL, timestamp, and outcome agreement.
- Cross-tenant audit rows and malformed/extra fields fail closed. Tenant or actor identifiers are not returned in the feed.
- The GET route remains private and `no-store`; UI refresh performs only a same-origin GET.

## Historical-run behavior

An activity audit row without `details.websiteReviewEvidence` produces:

```json
{
  "state": "UNAVAILABLE",
  "reason": "NOT_RECORDED"
}
```

The UI states that detailed website-review evidence was not recorded for the historical run and that signals, fit context, unknowns, and execution counters are unavailable. It does not infer a backfill from the event names, source domains, or prior runtime output.

## UI behavior

- English, French, and Arabic copy distinguishes observed keyword signals, potential fit, unverified unknowns, and cost/outbound counters.
- Arabic uses `lang="ar"` and `dir="rtl"`.
- Future READY evidence displays allowlisted signal labels, a human-review caveat, explicit unknowns, bounded request/byte counters, and exact-zero paid/Apollo/outbound/message/form/contact-reveal counters.
- Existing source URLs retain safe native HTTPS links with `target="_blank"` and `rel="noopener noreferrer"`; review-detail rendering initiates no fetch and does not open a source.

## TDD evidence

Real RED failures were observed before implementation:

- Persistence: 1 failure because the audit snapshot lacked the evidence bundle.
- Read model: 5 failures covering legacy state, valid evidence, run mismatch, strict malformed detail, and the feed shape.
- Activity panel: 3 failures covering evidence display and localized French/Arabic copy.
- Activity feed: 2 failures covering forwarding validated detail and fail-closed rejection of a raw field.
- Contract hardening: 3 failures for an overlong URL, a non-canonical timestamp, and positive evidence on a failed review.

Final validation:

- Vitest: 10 files, 53 tests passed.
- TypeScript: `tsc --noEmit --incremental false` exited 0.
- Scoped installed ESLint on implementation and test files exited 0.
- No production build was run, as required to preserve the active QA server and in-memory run.

## Live QA acceptance

Read-only GET before and after browser refresh returned HTTP 200 with private/no-store caching and:

- feed: `manovaflow.market-scout.activity-feed.v2`
- run: `e554a011-273b-43dd-a2ab-a59bed50b5e2`
- status: `COMPLETED`
- events: 4
- evidence: `UNAVAILABLE / NOT_RECORDED`

Browser acceptance on the existing Chrome tab confirmed the English, French, and Arabic historical labels, Arabic RTL direction, all four original events, and the unchanged run ID after the UI refresh. The tab was returned to English. No source link was opened.

## Explicit limitations

- Detailed evidence for a newly authorized run is covered by contract, persistence, read-model, route, and component tests only. This slice did not run a new real-network website review, so there is no real-network browser acceptance for READY detail.
- The current demo repository is in-memory; this evidence is not durable across a server restart.
- This work does not prove customer need, interest, buyer authority, workflow pain, or website ownership.

## Scope compliance

The QA server was not stopped, restarted, or built. No POST request, external site visit, new research run, package installation, Apollo credit, contact reveal, form submission, message, or outbound action occurred. No new agent was created.
