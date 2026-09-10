# Phase 2C Identity Operations Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independently credentialed least-privilege identity storage, idle/absolute lifecycle enforcement, safe cleanup, endpoint throttling, and append-only security audit.

**Architecture:** PostgreSQL migration 0003 creates a non-login identity runtime role and operational tables. A separate identity pool performs transaction-local role reduction; existing application membership queries stay on the application pool. Session, rate, cleanup, and audit mutations remain atomic and fail closed.

**Tech Stack:** Next.js 16.3.4, TypeScript 6 strict mode, Node.js crypto, Zod 4, PostgreSQL 14+, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-04-phase-2c-identity-operations-hardening-design.md`

## Global Constraints

- Do not create database login roles or store passwords in SQL.
- Production requires distinct application and identity database usernames.
- Do not trust forwarding headers without an explicit trusted-proxy contract.
- Store only cryptographic digests of browser credentials and rate-limit subjects.
- No provider activation, deployment, purchase, or outbound network call.
- This workspace has no Git metadata; verification checkpoints replace commit steps.

---

### Task 1: Least-privilege identity role and separate pool

**Files:**
- Create: `db/migrations/0003_identity_operations.sql`
- Modify: `src/lib/migrations.ts`
- Modify: `src/lib/database.ts`
- Modify: `src/lib/container.ts`
- Create: `src/modules/identity/infrastructure/identity-database.ts`
- Modify: `src/modules/identity/infrastructure/postgres-session-store.ts`
- Modify: `src/modules/identity/infrastructure/postgres-identity-link-port.ts`
- Test: `tests/integration/identity-database-boundary.test.ts`
- Test: `tests/unit/request-auth.test.ts`

**Interfaces:**
- Produces: `setIdentityRuntimeRole(transaction)` and a distinct `getIdentityDatabaseClient()` singleton.
- Produces: production configuration requiring `IDENTITY_DATABASE_URL` with a username distinct from `DATABASE_URL`.

- [x] Write failing tests proving the identity role cannot read tenant business tables, the application role cannot read identity tables, transaction-local roles/settings do not leak through a shared pool, and missing or aliased identity credentials fail closed.
- [x] Run focused unit/integration tests and confirm the expected schema/config failures.
- [x] Add migration role/grants and separate identity client construction without a login or password.
- [x] Apply transaction-local identity role reduction to every Phase 2B identity query.
- [x] Run focused tests to green twice.

### Task 2: Idle and absolute timeout enforcement

**Files:**
- Modify: `db/migrations/0003_identity_operations.sql`
- Modify: `src/modules/identity/infrastructure/postgres-session-store.ts`
- Modify: `src/modules/identity/infrastructure/production-identity.ts`
- Modify: `src/modules/identity/application/auth-port.ts`
- Test: `tests/integration/postgres-session-store.test.ts`

**Interfaces:**
- Consumes: `SESSION_IDLE_TIMEOUT_SECONDS` and the existing absolute `SESSION_MAX_LIFETIME_SECONDS`.
- Produces: transactionally refreshed `idle_expires_at` and typed `SESSION_IDLE_TIMEOUT`/`SESSION_EXPIRED` failures.

- [x] Write failing integration tests for idle expiry before absolute expiry, activity extending idle only up to the absolute deadline, and absolute expiry despite recent activity.
- [x] Run the focused tests and verify they fail on missing idle behavior.
- [x] Add persisted idle deadline, constructor policy, refresh logic, and timeout state transitions.
- [x] Run the focused tests to green without changing the immutable absolute deadline.

### Task 3: Append-only security audit

**Files:**
- Modify: `db/migrations/0003_identity_operations.sql`
- Create: `src/modules/identity/application/security-audit-port.ts`
- Create: `src/modules/identity/infrastructure/postgres-security-audit.ts`
- Modify: `src/modules/identity/infrastructure/postgres-session-store.ts`
- Test: `tests/unit/security-audit.test.ts`
- Test: `tests/integration/identity-operations.test.ts`

**Interfaces:**
- Produces: validated `SecurityAuditEventInput`, `appendSecurityAudit(transaction, event)`, and `PostgresSecurityAuditPort.append(event)`.
- Consumes: only UUIDs, hashes, enumerated event/outcome values, and secret-safe detail keys.

- [x] Write failing tests that reject secret-bearing detail keys and prove update/delete of persisted security events is blocked.
- [x] Run focused tests and confirm contract/schema failures.
- [x] Add the immutable table, trigger, validation, and identity-role insert grant.
- [x] Emit audit rows atomically from issue, replay, rotation, revocation, CSRF, and timeout transitions.
- [x] Run focused tests to green and verify raw credentials never appear in stored details.

### Task 4: Database-backed rate limiting

**Files:**
- Create: `src/modules/identity/application/auth-rate-limit-port.ts`
- Create: `src/modules/identity/infrastructure/postgres-auth-rate-limiter.ts`
- Modify: `src/modules/identity/infrastructure/production-identity.ts`
- Modify: `src/modules/identity/application/auth-port.ts`
- Modify: `src/lib/api-response.ts`
- Modify: `src/app/api/auth/session/rotate/route.ts`
- Modify: `src/app/api/auth/session/revoke/route.ts`
- Test: `tests/unit/auth-rate-limit.test.ts`
- Test: `tests/integration/identity-operations.test.ts`

**Interfaces:**
- Produces: HMAC request subject derivation, `AuthRateLimitPort.consume`, HTTP 429 with retry metadata, and global/per-subject fixed windows.

- [x] Write failing tests for deterministic secret-safe HMAC keys, per-subject and global blocking, `Retry-After`, and endpoint invocation before session work.
- [x] Run focused tests and confirm missing rate-limit behavior.
- [x] Implement atomic bucket updates with row locks and transactional blocked-event audit.
- [x] Wire both lifecycle endpoints and fail closed when rate-limit configuration is absent.
- [x] Run focused tests to green.

### Task 5: Bounded cleanup and operational wiring

**Files:**
- Create: `src/modules/identity/infrastructure/postgres-identity-maintenance.ts`
- Create: `scripts/cleanup-identity.ts`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`
- Test: `tests/integration/identity-operations.test.ts`

**Interfaces:**
- Produces: `PostgresIdentityMaintenance.cleanup({ now, batchSize, retentionSeconds })` returning exact expired/purged/digest/bucket counts.

- [x] Write failing integration tests proving cleanup is bounded, preserves live sessions, expires stale active sessions, purges only terminal rows beyond retention, and retains immutable audit.
- [x] Run the focused test and confirm missing maintenance behavior.
- [x] Implement `FOR UPDATE SKIP LOCKED` cleanup and a local CLI using only `IDENTITY_DATABASE_URL`.
- [x] Run the focused test twice to verify idempotency.

### Task 6: Complete verification and evidence report

**Files:**
- Modify: `docs/status/2026-09-04-phase-2c-status.md`

- [x] Run full ESLint and strict TypeScript checks.
- [x] Run all non-integration tests and record exact file/test counts.
- [x] Run all PostgreSQL integration tests and record exact file/test counts.
- [x] Run the Next.js optimized production build and inspect lifecycle routes.
- [x] Scan identity code/config for provider activation, raw credential persistence, role bypasses, and untrusted forwarding-header use.
- [x] Replace the incomplete Phase 2C status with verified evidence and remaining external-production gaps.
