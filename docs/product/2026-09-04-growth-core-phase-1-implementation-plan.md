# ManovaFlow Growth Core Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a locally runnable and tested vertical slice of one multi-tenant Growth Core that executes ServiceFlow, BeautyFlow, and BriefFlow lanes concurrently in Research-Only mode.

**Architecture:** A single Next.js App Router application contains a framework-independent Growth domain, three immutable vertical manifests, a separate allowlisted market-profile registry, an application orchestrator, PostgreSQL persistence with row-level tenant isolation, and a Persian RTL control dashboard. Inputs are manual company-level evidence or explicitly synthetic demo fixtures; all outbound connectors fail closed. Company fit and market readiness are scored separately so a vertical never embeds country logic.

**Tech Stack:** Next.js App Router, React, TypeScript strict, Zod, PostgreSQL, postgres.js, Vitest, Testing Library, ESLint, Docker Compose for local PostgreSQL.

**Spec:** docs/research/2026-09-04-manovaflow-final-strategy-decision.md

## Global Constraints

- All three lanes start and run concurrently in Research-Only mode.
- Every lane evaluates an independently bounded set of allowlisted market profiles; initial synthetic profiles are France, Istanbul/Turkey, Erbil/Kurdistan Region of Iraq, and Dubai/UAE.
- Market readiness is separate from company fit and does not change the legal decision that France is the only unverified company/payment-location hypothesis.
- Erbil/KRI is not treated as equivalent to all Iraq; contract, payment, data, and legal readiness remain UNKNOWN.
- Turkey cross-border payment, KVKK/IYS, and currency volatility remain separate gates.
- No market profile permits owner-residence concealment, false KYC, or a non-France incorporation path.
- One shared Legal & Compliance Gate sits above the three lanes; it is neither a fourth marketing agent nor legal counsel.
- The gate records dated official-source evidence as FACT, INFERENCE, or UNKNOWN and blocks Human-Send when any required legal path is unknown.
- ServiceFlow pack state is active development; BeautyFlow and BriefFlow remain validation backlog.
- No email, WhatsApp, LinkedIn, calls, advertisements, list purchase, booking, external mutation, or personal-data scraping.
- Candidate input contains company-level fields only and every scored signal carries a public evidence URL or a synthetic marker.
- Tenant identity comes from a server-side local demo context; client-controlled tenant headers are rejected.
- PostgreSQL rows are tenant-scoped and protected with RLS; audit events cannot be updated or deleted.
- Outbound gateway has no credentials and always returns a typed disabled result.
- Seeds use reserved example domains and are visibly marked fictional.
- Research documents other than the explicitly corrected final strategy remain byte-for-byte unchanged.
- No production-readiness claim is allowed from unit tests or a static build.

---

### Task 1: Project foundation and domain contracts

**Files:**
- Create: package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.ts, .gitignore, .env.example, compose.yaml
- Create: src/modules/growth/domain/types.ts
- Create: src/modules/growth/domain/candidate-schema.ts
- Create: src/modules/growth/domain/scoring.ts
- Create: src/modules/growth/domain/market-scoring.ts
- Create: src/modules/growth/domain/rbac.ts
- Create: src/modules/compliance/domain/gate.ts
- Test: tests/unit/candidate-schema.test.ts, tests/unit/scoring.test.ts, tests/unit/rbac.test.ts

**Interfaces:**
- Produces: parseCandidate(input), scoreCandidate(manifest, candidate), scoreMarket(profile, evidence), evaluateComplianceGate(input), requireCapability(actor, capability)
- Candidate input is a strict object containing laneKey, marketKey, companyName, domain, country, sourceUrl, sourceKind, synthetic, signalKeys, marketSignalKeys, and riskFlags.

- [x] Install only the pinned dependencies required by this plan.
- [x] Write tests proving personal contact fields and unsafe/private evidence URLs are rejected.
- [x] Run the candidate-schema test and confirm it fails because the parser does not exist.
- [x] Implement the strict Zod parser with HTTPS public URLs and reserved .example domains for synthetic records.
- [x] Run the test and confirm it passes.
- [x] Write scoring tests with hand-calculated company-fit and market-readiness totals, their independence, and prohibited-risk outcomes for all three manifests.
- [x] Run and confirm expected missing-module failures.
- [x] Implement deterministic scoring and RBAC; run the tests to green.
- [x] Write a compliance-gate test proving missing/expired/non-official evidence and UNKNOWN contract/payment/KYC paths block Human-Send while Research-Only remains available.
- [x] Run RED, implement the deterministic gate with disclaimer/checklist and human/counsel escalation, and run GREEN.

### Task 2: Three manifests and fail-closed safety

**Files:**
- Create: src/modules/growth/manifests/serviceflow.ts
- Create: src/modules/growth/manifests/beautyflow.ts
- Create: src/modules/growth/manifests/briefflow.ts
- Create: src/modules/growth/manifests/index.ts
- Create: src/modules/growth/markets/france.ts
- Create: src/modules/growth/markets/istanbul.ts
- Create: src/modules/growth/markets/erbil-kri.ts
- Create: src/modules/growth/markets/dubai.ts
- Create: src/modules/growth/markets/index.ts
- Create: src/modules/growth/infrastructure/outbound-gateway.ts
- Test: tests/unit/manifests.test.ts, tests/unit/markets.test.ts, tests/unit/outbound-gateway.test.ts

**Interfaces:**
- Produces: growthManifests keyed by serviceflow, beautyflow, briefflow.
- Produces: marketProfiles keyed by fr-france, tr-istanbul, iq-kri-erbil, ae-dubai, with locales, allowed public source categories, data/marketing gates, contract/payment readiness, acquisition budget, and explicit unknowns.
- Market profiles carry dated official-source references for outreach, data, AI disclosure, contract/payment, and sanctions/KYC; references are not silently treated as current legal determinations.
- Each manifest declares packState, ICP, weighted signals summing to 100, prohibited risk flags, allowed claims, forbidden claims, daily caps, draft template, and kill rules.
- Produces: DisabledOutboundGateway.send(), which always returns OUTBOUND_DISABLED_RESEARCH_ONLY and never accepts credentials.

- [x] Write manifest contract tests for distinct signals, claims, risks, pack states, and exact weight total 100.
- [x] Run and observe failure because manifests do not exist.
- [x] Implement the three immutable manifests and re-run to green.
- [x] Write market-profile tests proving KRI remains distinct from Iraq, France alone carries the entity hypothesis, all four markets are research-only, and vertical manifests contain no market fields.
- [x] Run RED, implement the four profiles and market registry, and run GREEN.
- [x] Write the outbound test proving every channel and every payload fails closed without side effects.
- [x] Run RED, implement the disabled gateway, and run GREEN.

### Task 3: Repository contract, dedupe, suppression, idempotency, audit, and PostgreSQL

**Files:**
- Create: src/modules/growth/application/repository.ts
- Create: src/modules/growth/infrastructure/in-memory-repository.ts
- Create: src/modules/growth/infrastructure/postgres-repository.ts
- Create: src/lib/database.ts
- Create: db/migrations/0001_growth_core.sql
- Create: scripts/migrate.ts
- Test: tests/unit/repository-contract.test.ts
- Test: tests/integration/postgres-repository.test.ts

**Interfaces:**
- Produces a GrowthRepository port with beginRun, completeRun, failRun, findCompany, saveCompany, isSuppressed, saveCompanyScore, saveMarketScore, saveComplianceDecision, findComplianceDecision, saveDraft, decideDraft, appendAudit, and getDashboard.
- Company fingerprint is tenant plus normalized domain; fallback is tenant plus normalized name and country.
- Research run key is unique by tenant, lane, and idempotency key.
- PostgreSQL methods execute inside a transaction that sets app.tenant_id before accessing tenant tables.

- [x] Write repository contract tests against the in-memory implementation for tenant isolation, tenant-wide cross-lane dedupe/suppression, separate market/company scores, immutable compliance decisions/tokens, audit ordering, and idempotent run reuse.
- [x] Run RED, implement the in-memory repository, and run GREEN.
- [x] Write the PostgreSQL integration test for cross-tenant denial, immutable audit, duplicate run reuse, and suppression.
- [x] Run it and confirm the expected database-unavailable or missing-schema failure.
- [x] Add the SQL migration with RLS, constraints, indexes, grants, and audit update/delete trigger.
- [x] Implement migration and PostgreSQL repository.
- [x] Start a local PostgreSQL instance if Docker becomes available; run migration and integration test to green. If Docker remains unavailable, report PostgreSQL as unverified and do not claim production readiness.

### Task 4: Parallel three-lane research orchestration

**Files:**
- Create: src/modules/growth/application/retry.ts
- Create: src/modules/growth/application/run-lane.ts
- Create: src/modules/growth/application/run-parallel.ts
- Create: src/modules/growth/demo/fixtures.ts
- Test: tests/unit/retry.test.ts
- Test: tests/unit/run-parallel.test.ts
- Test: tests/e2e/research-only-demo.test.ts

**Interfaces:**
- Produces runLane(context, manifest, allowedMarkets, candidates, repository).
- Produces runAllLanes(context, batchKey, inputsByLane, repository) using Promise.allSettled so lane failures are isolated.
- Every lane returns a market shortlist, company shortlist, evidence, confidence, rejection reasons, truthful unsent presentation drafts, and append-only audit events.
- Every lane consults the shared Legal & Compliance Gate before any state transition; Phase 1 stores a blocked Human-Send decision and issues no outbound authorization.
- Discovery enforces caps on markets, sources, elapsed time, and consecutive low-value additions; diminishing returns pause only the affected lane.

- [x] Write retry tests proving transient errors stop after three attempts and non-retryable errors are not retried.
- [x] Run RED, implement bounded retry, and run GREEN.
- [x] Write parallel-run tests proving all lanes start, one lane can fail independently, market discovery is separate from vertical scoring, duplicates/suppressions are tenant-wide, bounded discovery stops on diminishing returns, risk flags kill only their lane, and no lane can enter Human-Send without a matching recorded gate token.
- [x] Run RED, implement lane and batch orchestration, and run GREEN.
- [x] Write an end-to-end test using fictional fixtures across the four initial markets that asserts three completed lane reports, separate market/company shortlists, truthful pack-state-specific drafts, explicit France/Turkey/KRI/UAE compliance decisions, no Human-Send tokens, and zero outbound actions.
- [x] Run RED, implement fixtures and final orchestration behavior, and run GREEN.

### Task 5: Server API, local demo RBAC, and Persian dashboard

**Files:**
- Create: src/lib/demo-context.ts
- Create: src/lib/container.ts
- Create: src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
- Create: src/app/api/dashboard/route.ts
- Create: src/app/api/research/run/route.ts
- Create: src/app/api/drafts/[draftId]/decision/route.ts
- Create: src/app/api/suppressions/route.ts
- Create: src/components/growth-dashboard.tsx
- Test: tests/unit/demo-context.test.ts
- Test: tests/component/growth-dashboard.test.tsx
- Test: tests/unit/api-policy.test.ts

**Interfaces:**
- Demo context is enabled only when DEMO_MODE=true and NODE_ENV is not production; tenant and actor come from server environment and are schema-validated.
- POST /api/research/run requires Owner or Operator and an Idempotency-Key.
- GET /api/dashboard requires Viewer, Operator, or Owner.
- Draft decisions require Owner and remain internal-only; approval never enables sending.

- [x] Write tests proving production refuses demo context and Viewer cannot run research or decide drafts.
- [x] Run RED, implement demo context and route policy functions, and run GREEN.
- [x] Write component tests for three separate lane cards, global market comparison, separate market/company scores, aggregate metrics, visible synthetic labels, pack-state truthfulness, budget/rate counters, disabled outbound controls, and a prominent statement that the compliance gate is not a lawyer.
- [x] Run RED, implement the RTL dashboard and styles, and run GREEN.
- [x] Implement route handlers using strict server validation and typed error responses.
- [x] Verify API policy tests remain green.

### Task 6: Local operations and complete verification

**Files:**
- Create: scripts/seed.ts
- Create: scripts/run-demo.ts
- Create: README.md

**Interfaces:**
- migrate creates the schema without seed data.
- seed creates two fictional tenants, synthetic memberships, three lanes, four market-profile snapshots, and one tenant-wide suppression.
- run-demo executes all three lanes, prints a bounded non-PII summary, and exits nonzero if any lane fails or any outbound action exists.

- [x] Add scripts and README with exact local setup, environment, migration, seed, test, development, and demo commands.
- [x] Run formatter/lint and fix all errors.
- [x] Run TypeScript typecheck and fix all errors.
- [x] Run the full unit/component/end-to-end test suite and inspect zero failures.
- [x] Run the PostgreSQL integration suite against the local database if available.
- [x] Run the production Next.js build and inspect exit code zero.
- [x] Execute the CLI demo and inspect three independent completed lane reports, four comparable market profiles per lane, separate market/company shortlists, and zero outbound actions.
- [x] Start the local app, open the dashboard, run the parallel demo, and visually verify the safety banner and three lane outputs if PostgreSQL is available.
- [x] Re-hash all pre-existing research documents and report which one changed under the explicit strategy correction.
- [x] Report remaining gates: external auth/MFA, backup/restore, production credentials, legal review, real public-source adapter, deployment, accessibility/browser matrix, and real customer evidence.
