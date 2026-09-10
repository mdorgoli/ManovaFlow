# Market Scout Core Design

## Status and scope

This design adds a local, provider-neutral Market Scout orchestration layer to the existing Research-Only growth core. It does not add a network adapter, Apollo integration, route handler, scheduler, dashboard styling, outbound capability, deployment, or external mutation.

Apollo.io is not available to this task: no Apollo tool is registered in the active tool inventory, and the installation request fails with `plugin_id must match one of the entries in the <recommended_plugins> list`. The core therefore exposes an injected source port and is verified with an in-process test source only.

## Invariants

- The coordinator requires the existing `RUN_RESEARCH` capability before invoking any source.
- A non-empty batch idempotency key is required before work starts.
- Work is the Cartesian product of the three immutable vertical manifests and each manifest's bounded market selection.
- Worker concurrency is explicitly bounded from 1 through 12; the default is 4.
- Per-lane source and organization caps are partitioned deterministically across that lane's market tasks, and the partitions sum to the manifest caps.
- Source results are untrusted and validated at runtime.
- Accepted organizations must be non-synthetic, use one of `OFFICIAL_REGISTRY`, `PUBLIC_COMPANY_WEBSITE`, `OFFICIAL_ASSOCIATION`, or `OFFICIAL_PROCUREMENT`, and also be allowlisted by the market profile.
- Candidate lane, market, and country must exactly match the assigned task.
- Supported output languages are exactly English (`en`), French (`fr`), and Arabic (`ar`).
- Language is detected deterministically from bounded public organization text. Ambiguous text falls back to the first supported market locale and then to English.
- Arabic output carries `direction=RTL`; English and French carry `direction=LTR`.
- Existing candidate validation remains authoritative for strict shape, HTTPS, credential-free URLs, public-address boundaries, and personal-field rejection.
- A source result that exceeds its assigned source or organization budget, reports paid spend, or has a malformed envelope fails only that worker and contributes no candidates.
- Candidate-level validation failures are counted by safe reason code and never persist raw rejected input.
- Fulfilled worker candidates are grouped deterministically and passed to the existing `runAllLanes`; `runLane` remains the single implementation of dedupe, suppression, company scoring, market scoring, Compliance Gate decisions, draft persistence, audit, and lane budgets.
- Output is limited to worker health, the existing market/company shortlists, internal drafts, compliance decisions, and aggregate counts.
- Every draft remains `outboundEnabled=false`; every authorization token remains `null`; aggregate outbound actions remain `0`.

## Components

### Source contract

`MarketScoutSource.discover(request)` receives one lane-by-market task, an exact budget allocation, and an abort signal. It returns an unknown runtime envelope containing a candidate and bounded public organization text for language detection. The core validates that envelope before accepting any candidate.

The source contract is read-only. Implementations must not send messages, enrich personal contacts, buy lists, mutate provider state, or perform booking, advertising, calling, or payment actions.

### Worker

`runMarketScoutWorker` validates the source envelope and each candidate, detects `en`, `fr`, or `ar`, and assigns LTR/RTL direction. It returns accepted candidates plus safe language metadata and rejection counts. It throws only for task-level source/envelope/budget failures, allowing the coordinator to isolate the failure.

### Coordinator

`runMarketScout` builds tasks in lane order and market-registry order, assigns deterministic budgets, executes them through a bounded in-process worker pool, then calls `runAllLanes` once with the accepted candidates and detected language map. Worker outcomes remain visible separately from lane outcomes. Company shortlist rows and a Market Scout internal-draft projection expose language and direction; draft copy is produced in the detected language and remains explicitly NOT SENT.

## Failure model

- Authorization, invalid batch key, and invalid concurrency fail before source invocation.
- A source exception or invalid source envelope rejects only its assigned worker.
- Invalid candidate records are omitted and counted without failing sibling candidates.
- A failed market worker does not prevent other market workers or any lane report from completing.
- Existing repository or lane failures keep the existing `Promise.allSettled` isolation and bounded retry semantics.

## Verification

Focused unit tests must prove task matrix construction, actual bounded parallelism, exact budget partitioning, public-source allowlisting, scope enforcement, deterministic English/French/Arabic detection and locale fallback, Arabic RTL metadata, malformed/over-budget failure isolation, tenant-wide dedupe and suppression, Compliance Gate blocking, same-language internal-only drafts, and zero outbound actions. An end-to-end test uses only an in-process source and performs no network access. The English-only application shell is not modified.
