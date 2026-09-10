# Phase 2B OIDC and Secure Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offline, provider-neutral OIDC verification and stateful opaque browser sessions with MFA, CSRF, replay, rotation, and revocation enforcement.

**Architecture:** A verifier port authenticates an ID token using static public JWKs without network access. A session service maps the verified OIDC subject to a local actor, checks membership, and delegates atomic state changes to PostgreSQL; an AuthPort adapter validates secure cookies on every protected request.

**Tech Stack:** Next.js 16.3.4, TypeScript 6 strict mode, Node.js crypto, Zod 4, PostgreSQL 14+, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-04-phase-2b-oidc-secure-session-design.md`

## Global Constraints

- No remote discovery, JWKS fetch, provider activation, purchase, deployment, or outbound network call.
- Production accepts only asymmetric `RS256` or `ES256` signatures from explicitly configured static public JWKs.
- RBAC role remains exclusively owned by `MembershipPort`.
- Source edits use TDD and every security regression must be observed failing before implementation.
- This workspace has no Git metadata; verification checkpoints replace commit steps.

---

### Task 1: OIDC verification contract and offline verifier

**Files:**
- Create: `src/modules/identity/application/oidc-port.ts`
- Create: `src/modules/identity/infrastructure/offline-oidc-jwt-verifier.ts`
- Modify: `src/modules/identity/application/auth-port.ts`
- Test: `tests/unit/oidc-jwt-verifier.test.ts`

**Interfaces:**
- Produces: `OidcTokenVerifierPort.verifyIdToken(input): Promise<VerifiedOidcIdentity>`.
- Produces: `OfflineOidcJwtVerifier` configured with issuer, audience, static JWKS, algorithm allowlist, MFA markers, clock skew, token lifetime, and MFA age.

- [x] Write tests signing deterministic claim fixtures with local RSA keys for valid verification, bad signature, `alg=none`, wrong issuer/audience/nonce, expiry, future times, excessive lifetime, missing MFA, and stale MFA.
- [x] Run the focused test and confirm module-not-found or missing-contract failures.
- [x] Add typed OIDC errors and the verifier contract.
- [x] Implement strict compact-JWS decoding, JWK selection, asymmetric signature verification, claim checks, and MFA freshness.
- [x] Run the focused test to green and run the existing auth-boundary tests.

### Task 2: Opaque session transport and application service

**Files:**
- Create: `src/modules/identity/application/session-port.ts`
- Create: `src/modules/identity/application/oidc-session-service.ts`
- Create: `src/modules/identity/infrastructure/session-cookie.ts`
- Create: `src/modules/identity/infrastructure/oidc-session-auth-port.ts`
- Test: `tests/unit/session-cookie.test.ts`
- Test: `tests/unit/oidc-session-service.test.ts`

**Interfaces:**
- Produces: `SessionStorePort.issue`, `authenticate`, `rotate`, and `revoke`.
- Produces: `OidcSessionService.establish`, `rotateRequest`, and `revokeRequest`.
- Produces: strict cookie parsing/serialization and unsafe-method origin/CSRF validation.

- [x] Write failing tests for secure `__Host-` cookie attributes, duplicate cookies, missing/mismatched CSRF, wrong Origin, safe-method authentication, membership denial, and typed replay propagation.
- [x] Run both focused tests and confirm failures identify missing behavior.
- [x] Implement the minimal ports, cookie transport, service orchestration, and AuthPort adapter.
- [x] Run the focused tests to green and refactor only duplicated validation.

### Task 3: PostgreSQL session state and atomic lifecycle

**Files:**
- Create: `db/migrations/0002_identity_sessions.sql`
- Modify: `src/lib/migrations.ts`
- Create: `src/modules/identity/infrastructure/postgres-identity-link-port.ts`
- Create: `src/modules/identity/infrastructure/postgres-session-store.ts`
- Test: `tests/integration/postgres-session-store.test.ts`

**Interfaces:**
- Produces: server-owned issuer/subject mapping and `PostgresSessionStore` implementing the Task 2 contract.
- Consumes: SHA-256 token digests, verified OIDC identity, local actor/tenant, and current time.

- [x] Write integration tests for one-time OIDC exchange, valid authentication, CSRF binding, atomic rotation, rotated-token replay compromising the family, current-token rejection after compromise, and explicit revocation.
- [x] Run the focused integration test and confirm schema/module failures.
- [x] Add idempotent migration 0002 and ordered migration loading.
- [x] Implement transactional issue/authenticate/rotate/revoke with `SELECT ... FOR UPDATE` and commit replay-compromise state before throwing typed errors.
- [x] Run the focused integration test to green twice to prove migration idempotency and stable cleanup.

### Task 4: Production wiring and session lifecycle routes

**Files:**
- Create: `src/modules/identity/infrastructure/production-identity.ts`
- Modify: `src/lib/request-auth.ts`
- Create: `src/app/api/auth/session/rotate/route.ts`
- Create: `src/app/api/auth/session/revoke/route.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/unit/request-auth.test.ts`

**Interfaces:**
- Produces: strict environment configuration and production services using static JWKS plus PostgreSQL.
- Produces: CSRF-protected rotation and revocation endpoints that set or clear hardened cookies.

- [x] Write failing wiring tests proving incomplete config stays fail-closed and production never falls back to demo identity.
- [x] Run the focused tests and confirm expected failure.
- [x] Implement production factory, AuthPort selection, lifecycle routes, and documented configuration without adding provider callbacks.
- [x] Run request-auth and API policy tests to green.

### Task 5: Complete verification and evidence report

**Files:**
- Modify: `docs/status/2026-09-04-phase-2b-status.md`

**Interfaces:**
- Consumes: all Phase 2B implementation and verification output.
- Produces: a factual status report separating evidence from remaining production gaps.

- [x] Run ESLint over the full workspace.
- [x] Run TypeScript with `--noEmit`.
- [x] Run all non-integration tests and record exact file/test counts.
- [x] Run all PostgreSQL integration tests against the local disposable database and record exact counts.
- [x] Run the Next.js optimized production build and inspect generated routes.
- [x] Re-read the approved spec line by line, scan for identity bypasses and outbound/provider activation, then replace the incomplete Phase 2B status with verified evidence and remaining gaps.
