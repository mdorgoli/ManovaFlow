# Market Scout Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bounded multi-market Market Scout coordinator that distributes lane-by-market discovery work in parallel and feeds only validated public-organization candidates into the existing Research-Only pipeline.

**Architecture:** A provider-neutral source port returns untrusted discovery envelopes to isolated workers. A bounded coordinator partitions each lane's manifest budgets across market tasks, collects validated candidates, and delegates all persistence, dedupe, suppression, scoring, compliance, drafting, and audit behavior to the existing `runAllLanes` and `runLane` services.

**Tech Stack:** TypeScript 6 strict mode, Zod 4, Vitest 5, existing Next.js 16.3.4 application core.

**Spec:** `docs/superpowers/specs/2026-09-04-market-scout-core-design.md`

## Global Constraints

- No live provider, Apollo adapter, network call, route, scheduler, deployment, or external mutation.
- Accept organization-level public evidence only; reject synthetic, referral, personal, private-address, credential-bearing, or task-mismatched records.
- Support only `en`, `fr`, and `ar`; detect from bounded public text, use market-locale fallback, and mark Arabic as RTL.
- Keep the application shell English-only and do not change public-site or dashboard styling.
- Preserve existing repository, compliance, idempotency, tenant, draft, and outbound contracts.
- Human-Send remains blocked, authorization tokens remain null, and outbound actions remain zero.
- This workspace has no Git metadata; verified checkpoints replace commit steps.

---

### Task 1: Source contract and isolated worker

**Files:**
- Create: `src/modules/growth/application/market-scout-contracts.ts`
- Create: `src/modules/growth/application/market-scout-language.ts`
- Create: `src/modules/growth/application/market-scout-worker.ts`
- Test: `tests/unit/market-scout-language.test.ts`
- Test: `tests/unit/market-scout-worker.test.ts`

**Interfaces:**
- Produces: `MarketScoutSource`, `MarketScoutTask`, `MarketScoutBudget`, `MarketScoutDiscoveryEnvelope`, `detectMarketScoutLanguage(input)`, and `runMarketScoutWorker(input)`.
- Consumes: `parseCandidate`, immutable manifests, and market profiles.

- [x] Write focused tests whose breaking mutations are removal of English/French/Arabic detection, market-locale fallback, Arabic RTL mapping, the public-kind allowlist, task-scope check, strict candidate parser, or source budget check.
- [x] Run the focused test and verify failure because the Market Scout worker modules do not exist.
- [x] Implement bounded public-text validation, deterministic language detection, runtime envelope validation, public-source allowlisting, exact lane/market/country scope enforcement, safe rejection counts, and fail-closed task errors.
- [x] Run the focused test to green.

### Task 2: Bounded coordinator and existing pipeline integration

**Files:**
- Create: `src/modules/growth/application/market-scout-coordinator.ts`
- Modify: `src/modules/growth/application/run-lane.ts`
- Modify: `src/modules/growth/application/run-parallel.ts`
- Test: `tests/unit/market-scout-coordinator.test.ts`

**Interfaces:**
- Produces: `runMarketScout(input)` and `MarketScoutResult` with localized shortlist metadata and internal-draft projections.
- Consumes: `MarketScoutSource`, `runMarketScoutWorker`, `runAllLanes`, manifests, market profiles, and `GrowthRepository`.

- [x] Write focused tests whose breaking mutations are sequential execution, concurrency-limit bypass, incorrect Cartesian task coverage, cap over-allocation, lost language metadata, wrong draft language/direction, whole-run failure on one worker error, bypassed suppression, or missing tenant-wide dedupe.
- [x] Run the focused test and verify failure because the coordinator does not exist.
- [x] Implement pre-source authorization and input validation, deterministic cap partitioning, a bounded worker pool, stable outcome ordering, candidate/language grouping, localized internal draft copy, and one call to the existing parallel lane pipeline.
- [x] Run worker and coordinator tests to green twice.

### Task 3: End-to-end Research-Only evidence and status

**Files:**
- Create: `tests/e2e/market-scout-research-only.test.ts`
- Create: `docs/status/2026-09-04-market-scout-status.md`

**Interfaces:**
- Consumes: `runMarketScout` with an in-process source and `InMemoryGrowthRepository`.
- Produces: verified evidence that all twelve tasks can feed three lane reports without any outbound capability.

- [x] Write an end-to-end test with literal English, French, and Arabic public-organization fixtures across all twelve tasks; assert same-language shortlists and drafts, Arabic RTL metadata, blocked Human-Send decisions, null authorization tokens, and zero outbound actions.
- [x] Run the end-to-end test and verify RED before adding any fixture helper needed by production code; keep all fake-source logic in the test.
- [x] Make only the minimal core correction required for GREEN, then rerun the focused suite.
- [x] Run ESLint, strict TypeScript, all non-integration tests, and the optimized Next.js build.
- [x] Scan the new implementation for `fetch`, provider credentials, action routes, outbound calls, personal-contact fields, and changes to public-site styling.
- [x] Record exact verification evidence and the unavailable Apollo error in the status report without claiming live-source or production readiness.
