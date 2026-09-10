# Phase 2C Identity Operations Hardening Design

## Scope

Phase 2C hardens the local Phase 2B identity subsystem without enabling a provider or deployment. Production requires a second PostgreSQL credential supplied as `IDENTITY_DATABASE_URL`; it must use a different username from `DATABASE_URL`. Migrations create only a non-login group role and never create or store a password.

## Database authority and pool isolation

Migration 0003 creates `manovaflow_identity_runtime` with `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, and `NOBYPASSRLS`. Every rerun explicitly restores all attributes, revokes schema/table privilege drift, and then reapplies the exact authentication, rate-limit, and security-audit allowlist. The migration runner grants that group role to its own session user for local verification; a production identity login must be provisioned externally and granted membership by an operator.

The application pool and identity pool are distinct process singletons. Membership/RLS queries continue through the application pool and `manovaflow_app`; session, identity-link, rate-limit, maintenance, and security-audit operations use the identity pool and execute `SET LOCAL ROLE manovaflow_identity_runtime` inside every transaction. Failure to set the role or incomplete/aliased production credentials closes authentication.

## Timeout and lifecycle

`auth_sessions.expires_at` remains the immutable absolute deadline. Migration 0003 adds `idle_expires_at`; successful authentication and rotation move it to `min(absolute expiry, now + configured idle timeout)`. Crossing idle, absolute, or MFA expiry atomically expires the session, revokes active credentials, and appends a security event.

Cleanup is an explicit bounded operation, not a request side effect. It locks expired rows with `FOR UPDATE SKIP LOCKED`, expires live rows first, then purges terminal sessions older than the configured retention window. It also removes expired OIDC replay digests and stale rate buckets in bounded batches while preserving append-only security events.

## Rate limiting

Rotate and revoke endpoints consume two PostgreSQL fixed-window buckets before session work: a global operation bucket and an HMAC-derived subject bucket. The subject input is only the single canonical 43-character session-cookie token; unrelated cookies and cookie ordering are ignored. Missing, invalid, duplicate, or oversized session-cookie contexts share one fixed fallback bucket, while duplicate or oversized headers are still rejected by session authentication. The HMAC key is a required 256-bit secret; raw cookie, token, CSRF, IP, or authorization data is never stored. Missing or invalid configuration is fail-closed. A blocked request receives HTTP 429 and `Retry-After`, and a security audit event is appended transactionally.

Because no trusted proxy contract exists in this local phase, client-supplied forwarding headers are not trusted. The global bucket prevents unbounded aggregate work; the subject bucket limits repeated use of the same canonical session credential, and its invalid-context fallback prevents malformed-cookie bucket spraying. Edge/IP throttling remains a deployment gate.

## Append-only security audit

`identity_security_events` records immutable UUID, timestamp, event type, outcome, optional tenant/actor/session identifiers, hashed subject/request identifiers, and a small validated JSON detail object. A database trigger rejects update and delete. Store transitions emit issued, rotated, revoked, replay-blocked, timeout, MFA-expired, and CSRF-blocked events in the same transaction as the protected state change. Rate-limit blocks and maintenance purges are also recorded.

Audit validation rejects detail keys that could carry token, cookie, secret, authorization, password, or CSRF material. Audit insertion is mandatory: a failed audit write rolls back the protected state transition.

## Acceptance evidence

TDD covers separate production database configuration, role privilege denials, transaction-local role reset, tenant/application pool isolation, idle and absolute timeout, bounded cleanup, rate-limit retry behavior, append-only audit mutation rejection, and incomplete configuration. Full lint, strict typecheck, non-integration tests, PostgreSQL integration tests, and the Next.js optimized build are required before the status report changes from incomplete.
