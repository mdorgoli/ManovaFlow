# Phase 2B OIDC and Secure Session Design

## Scope

Phase 2B adds a provider-neutral, offline-verifiable OIDC boundary and an opaque application session. No discovery endpoint, remote JWKS fetch, identity provider, login UI, purchase, deployment, or outbound network call is introduced.

## Security invariants

- Production identity begins only with a compact JWS whose asymmetric signature matches one configured static public JWK and an explicit algorithm allowlist.
- The verifier requires exact issuer, intended audience, current expiry, sane issuance/not-before times, exact nonce, and recent MFA evidence from configured `amr` or `acr` values.
- OIDC subject-to-local-actor mapping is server-owned. OIDC claims never assign an application role; `MembershipPort` remains the sole RBAC authority.
- A verified ID token can establish at most one application session. Its SHA-256 digest is stored with a unique constraint to reject exchange replay.
- The browser receives a random 256-bit opaque session token in a `__Host-` cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and no `Domain`.
- A separate random CSRF value is bound by hash to the active session credential. Unsafe requests require an exact trusted `Origin`, matching CSRF cookie/header values, and the server-side hash.
- Rotation is atomic: the presented credential becomes `ROTATED` before a new generation becomes active. Reuse of a rotated credential marks the entire session `COMPROMISED` and revokes every active generation.
- Revocation is server-side and immediate. Expired, revoked, compromised, malformed, unknown, duplicated-cookie, or replayed credentials fail closed.
- Absolute session lifetime never exceeds the verified OIDC token expiry or the configured session TTL. MFA freshness is stored and rechecked on every authenticated request.

## Components and data flow

`OfflineOidcJwtVerifier` validates locally configured JWK material and returns only verified issuer, subject, token timing, and MFA evidence. `PostgresIdentityLinkPort` maps issuer/subject to a local actor. `OidcSessionService` confirms tenant membership, prevents OIDC token replay, and issues/rotates/revokes opaque credentials through `PostgresSessionStore`. `OidcSessionAuthPort` reads the secure cookie, enforces CSRF/origin rules for unsafe methods, and returns the existing `VerifiedSession` contract; the existing authorization pipeline then resolves the current database role.

## Persistence

- `oidc_identities`: unique `(issuer, subject)` to local `actor_id` mappings.
- `auth_sessions`: actor, tenant, issuer/subject, MFA timestamps, absolute expiry, state, and rotation counter.
- `auth_session_credentials`: one hashed opaque token per generation, its bound CSRF hash, lifecycle state, and timestamps.
- `consumed_oidc_tokens`: unique verified ID-token digests used to prevent replay.

The authentication tables are not exposed to the tenant data role. PostgreSQL row locks and transactions serialize rotation, replay compromise, and revocation.

## Failure behavior

Cryptographic or claim validation failures return a generic invalid-token authentication error. Missing MFA and stale MFA remain distinct policy errors. OIDC replay, rotated-token reuse, revoked sessions, CSRF failure, and origin failure have typed errors with no token or claim disclosure. Invalid or incomplete production configuration selects the existing fail-closed adapter.

## Acceptance evidence

Unit tests use locally generated asymmetric keypairs and make no network calls. PostgreSQL integration tests prove one-time token exchange, rotation, old-token compromise, new-token invalidation after replay, revocation, and CSRF binding. Full lint, strict typecheck, all test suites, and the Next.js production build must pass before the status report changes from incomplete.

