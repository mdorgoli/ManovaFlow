import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";
import {
  AuthenticationError,
  verifiedSessionSchema,
  type AuthenticationErrorCode,
  type VerifiedSession
} from "../application/auth-port";
import { verifiedOidcIdentitySchema } from "../application/oidc-port";
import type {
  AuthenticateSessionInput,
  IssuedSession,
  IssueSessionInput,
  RevokeSessionInput,
  RotateSessionInput,
  SessionStorePort
} from "../application/session-port";
import type { SecurityAuditEventInput } from "../application/security-audit-port";
import { setIdentityRuntimeRole } from "./identity-database";
import { appendSecurityAudit } from "./postgres-security-audit";

const timestamp = z.iso.datetime({ offset: true });
const digestPattern = /^[0-9a-f]{64}$/;
const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const issueInputSchema = z.strictObject({
  identity: verifiedOidcIdentitySchema,
  actorId: z.uuid(),
  tenantId: z.uuid(),
  oidcTokenHash: z.string().regex(digestPattern),
  expiresAt: timestamp,
  now: z.date()
});

interface CredentialRow {
  credential_state: "ACTIVE" | "ROTATED" | "REVOKED";
  csrf_hash: string;
  generation: number;
  credential_expires_at: Date | string;
  session_id: string;
  tenant_id: string;
  actor_id: string;
  issuer: string;
  subject: string;
  session_state: "ACTIVE" | "REVOKED" | "COMPROMISED" | "EXPIRED";
  mfa_method: string;
  mfa_verified_at: Date | string;
  mfa_expires_at: Date | string;
  issued_at: Date | string;
  session_expires_at: Date | string;
  idle_expires_at: Date | string;
}

type SessionFailureCode = Extract<
  AuthenticationErrorCode,
  | "INVALID_SESSION"
  | "SESSION_EXPIRED"
  | "SESSION_IDLE_TIMEOUT"
  | "SESSION_REVOKED"
  | "SESSION_REPLAY_DETECTED"
  | "MFA_EXPIRED"
  | "CSRF_VALIDATION_FAILED"
>;

type OperationOutcome<T> =
  { ok: true; value: T } | { ok: false; code: SessionFailureCode };

export class PostgresSessionStore implements SessionStorePort {
  readonly #sql: postgres.Sql;
  readonly #idleTimeoutMs: number;

  constructor(
    sql: postgres.Sql,
    configuration: { idleTimeoutSeconds: number }
  ) {
    if (
      !Number.isInteger(configuration.idleTimeoutSeconds) ||
      configuration.idleTimeoutSeconds < 60 ||
      configuration.idleTimeoutSeconds > 86_400
    ) {
      throw new Error(
        "Session idle timeout must be between 60 and 86400 seconds"
      );
    }
    this.#sql = sql;
    this.#idleTimeoutMs = configuration.idleTimeoutSeconds * 1_000;
  }

  async issue(rawInput: IssueSessionInput): Promise<IssuedSession> {
    const parsed = issueInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new AuthenticationError("OIDC_TOKEN_INVALID");
    const input = parsed.data;
    const nowMs = input.now.getTime();
    const expiresAtMs = Date.parse(input.expiresAt);
    const identityExpiresAtMs = Date.parse(input.identity.expiresAt);
    const mfaExpiresAtMs = Date.parse(input.identity.mfa.expiresAt);
    if (
      expiresAtMs <= nowMs ||
      expiresAtMs > identityExpiresAtMs ||
      mfaExpiresAtMs <= nowMs
    ) {
      throw new AuthenticationError(
        mfaExpiresAtMs <= nowMs ? "MFA_EXPIRED" : "OIDC_TOKEN_INVALID"
      );
    }

    const sessionId = randomUUID();
    const sessionToken = generateOpaqueToken();
    const csrfToken = generateOpaqueToken();
    const tokenHash = hashSecret(sessionToken);
    const csrfHash = hashSecret(csrfToken);

    const inserted = await this.#sql.begin(async (tx) => {
      await setIdentityRuntimeRole(tx);
      const consumed = await tx<{ token_hash: string }[]>`
        insert into consumed_oidc_tokens (
          token_hash, issuer, subject, consumed_at, expires_at
        ) values (
          ${input.oidcTokenHash},
          ${input.identity.issuer},
          ${input.identity.subject},
          ${input.now},
          ${new Date(identityExpiresAtMs)}
        )
        on conflict (token_hash) do nothing
        returning token_hash
      `;
      if (consumed.length === 0) {
        await appendSecurityAudit(tx, {
          eventType: "OIDC_TOKEN_REPLAY_BLOCKED",
          outcome: "BLOCKED",
          occurredAt: input.now,
          tenantId: input.tenantId,
          actorId: input.actorId,
          subjectHash: hashIdentitySubject(
            input.identity.issuer,
            input.identity.subject
          ),
          requestHash: input.oidcTokenHash,
          details: { reason: "oidc_token_digest_reused" }
        });
        return false;
      }

      await tx`
        insert into auth_sessions (
          id, tenant_id, actor_id, issuer, subject, state,
          mfa_method, mfa_verified_at, mfa_expires_at,
          issued_at, last_seen_at, expires_at, idle_expires_at,
          rotation_counter
        ) values (
          ${sessionId}::uuid,
          ${input.tenantId}::uuid,
          ${input.actorId}::uuid,
          ${input.identity.issuer},
          ${input.identity.subject},
          'ACTIVE',
          ${input.identity.mfa.method},
          ${new Date(input.identity.mfa.verifiedAt)},
          ${new Date(input.identity.mfa.expiresAt)},
          ${input.now},
          ${input.now},
          ${new Date(expiresAtMs)},
          ${this.#nextIdleExpiry(input.now, new Date(expiresAtMs))},
          0
        )
      `;
      await tx`
        insert into auth_session_credentials (
          token_hash, session_id, generation, csrf_hash,
          state, issued_at, expires_at
        ) values (
          ${tokenHash},
          ${sessionId}::uuid,
          0,
          ${csrfHash},
          'ACTIVE',
          ${input.now},
          ${new Date(expiresAtMs)}
        )
      `;
      await appendSecurityAudit(tx, {
        eventType: "OIDC_SESSION_ISSUED",
        outcome: "SUCCEEDED",
        occurredAt: input.now,
        tenantId: input.tenantId,
        actorId: input.actorId,
        sessionId,
        subjectHash: hashIdentitySubject(
          input.identity.issuer,
          input.identity.subject
        ),
        requestHash: input.oidcTokenHash,
        details: { generation: 0 }
      });
      return true;
    });

    if (!inserted) throw new AuthenticationError("OIDC_TOKEN_REPLAYED");
    return {
      sessionId,
      sessionToken,
      csrfToken,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  }

  async authenticate(
    input: AuthenticateSessionInput
  ): Promise<VerifiedSession> {
    assertOpaqueToken(input.sessionToken, "INVALID_SESSION");
    const tokenHash = hashSecret(input.sessionToken);
    const outcome = await this.#sql.begin(
      async (tx): Promise<OperationOutcome<VerifiedSession>> => {
        await setIdentityRuntimeRole(tx);
        const rows = await tx<CredentialRow[]>`
        select
          c.state as credential_state,
          c.csrf_hash,
          c.generation,
          c.expires_at as credential_expires_at,
          s.id as session_id,
          s.tenant_id,
          s.actor_id,
          s.issuer,
          s.subject,
          s.state as session_state,
          s.mfa_method,
          s.mfa_verified_at,
          s.mfa_expires_at,
          s.issued_at,
          s.expires_at as session_expires_at,
          s.idle_expires_at
        from auth_session_credentials c
        join auth_sessions s on s.id = c.session_id
        where c.token_hash = ${tokenHash}
        for update of c, s
      `;
        const row = rows[0];
        if (!row) return failure("INVALID_SESSION");
        if (row.credential_state === "ROTATED") {
          await compromiseSession(tx, row.session_id, input.now);
          await appendSessionAudit(
            tx,
            row,
            "SESSION_REPLAY_BLOCKED",
            "BLOCKED",
            input.now,
            { generation: row.generation }
          );
          return failure("SESSION_REPLAY_DETECTED");
        }
        if (
          row.credential_state !== "ACTIVE" ||
          row.session_state !== "ACTIVE"
        ) {
          return failure("SESSION_REVOKED");
        }
        const temporalFailure = sessionTemporalFailure(row, input.now);
        if (temporalFailure) {
          await expireSession(tx, row.session_id, input.now);
          await appendSessionAudit(
            tx,
            row,
            timeoutAuditEvent(temporalFailure),
            "EXPIRED",
            input.now,
            { reason: temporalFailure.toLocaleLowerCase("en-US") }
          );
          return failure(temporalFailure);
        }
        if (input.requireCsrf) {
          if (!input.csrfToken || !opaqueTokenPattern.test(input.csrfToken)) {
            await appendSessionAudit(
              tx,
              row,
              "SESSION_CSRF_BLOCKED",
              "BLOCKED",
              input.now,
              { operation: "authenticate" }
            );
            return failure("CSRF_VALIDATION_FAILED");
          }
          if (
            !constantTimeDigestEqual(row.csrf_hash, hashSecret(input.csrfToken))
          ) {
            await appendSessionAudit(
              tx,
              row,
              "SESSION_CSRF_BLOCKED",
              "BLOCKED",
              input.now,
              { operation: "authenticate" }
            );
            return failure("CSRF_VALIDATION_FAILED");
          }
        }
        await tx`
        update auth_sessions
        set last_seen_at = ${input.now},
            idle_expires_at = ${this.#nextIdleExpiry(
              input.now,
              toDate(row.session_expires_at)
            )}
        where id = ${row.session_id}::uuid
      `;
        return { ok: true, value: sessionFromRow(row) };
      }
    );
    return unwrap(outcome);
  }

  async rotate(input: RotateSessionInput): Promise<IssuedSession> {
    assertOpaqueToken(input.sessionToken, "INVALID_SESSION");
    assertOpaqueToken(input.csrfToken, "CSRF_VALIDATION_FAILED");
    const oldTokenHash = hashSecret(input.sessionToken);
    const presentedCsrfHash = hashSecret(input.csrfToken);
    const nextSessionToken = generateOpaqueToken();
    const nextCsrfToken = generateOpaqueToken();
    const nextTokenHash = hashSecret(nextSessionToken);
    const nextCsrfHash = hashSecret(nextCsrfToken);

    const outcome = await this.#sql.begin(
      async (tx): Promise<OperationOutcome<IssuedSession>> => {
        await setIdentityRuntimeRole(tx);
        const rows = await tx<CredentialRow[]>`
        select
          c.state as credential_state,
          c.csrf_hash,
          c.generation,
          c.expires_at as credential_expires_at,
          s.id as session_id,
          s.tenant_id,
          s.actor_id,
          s.issuer,
          s.subject,
          s.state as session_state,
          s.mfa_method,
          s.mfa_verified_at,
          s.mfa_expires_at,
          s.issued_at,
          s.expires_at as session_expires_at,
          s.idle_expires_at
        from auth_session_credentials c
        join auth_sessions s on s.id = c.session_id
        where c.token_hash = ${oldTokenHash}
        for update of c, s
      `;
        const row = rows[0];
        if (!row) return failure("INVALID_SESSION");
        if (row.credential_state === "ROTATED") {
          await compromiseSession(tx, row.session_id, input.now);
          await appendSessionAudit(
            tx,
            row,
            "SESSION_REPLAY_BLOCKED",
            "BLOCKED",
            input.now,
            { generation: row.generation }
          );
          return failure("SESSION_REPLAY_DETECTED");
        }
        if (
          row.credential_state !== "ACTIVE" ||
          row.session_state !== "ACTIVE"
        ) {
          return failure("SESSION_REVOKED");
        }
        const temporalFailure = sessionTemporalFailure(row, input.now);
        if (temporalFailure) {
          await expireSession(tx, row.session_id, input.now);
          await appendSessionAudit(
            tx,
            row,
            timeoutAuditEvent(temporalFailure),
            "EXPIRED",
            input.now,
            { reason: temporalFailure.toLocaleLowerCase("en-US") }
          );
          return failure(temporalFailure);
        }
        if (!constantTimeDigestEqual(row.csrf_hash, presentedCsrfHash)) {
          await appendSessionAudit(
            tx,
            row,
            "SESSION_CSRF_BLOCKED",
            "BLOCKED",
            input.now,
            { operation: "rotate" }
          );
          return failure("CSRF_VALIDATION_FAILED");
        }

        await tx`
        update auth_session_credentials
        set state = 'ROTATED', consumed_at = ${input.now}
        where token_hash = ${oldTokenHash}
          and state = 'ACTIVE'
      `;
        await tx`
        insert into auth_session_credentials (
          token_hash, session_id, generation, csrf_hash,
          state, issued_at, expires_at
        ) values (
          ${nextTokenHash},
          ${row.session_id}::uuid,
          ${row.generation + 1},
          ${nextCsrfHash},
          'ACTIVE',
          ${input.now},
          ${toDate(row.session_expires_at)}
        )
      `;
        await tx`
        update auth_sessions
        set rotation_counter = rotation_counter + 1,
            last_seen_at = ${input.now},
            idle_expires_at = ${this.#nextIdleExpiry(
              input.now,
              toDate(row.session_expires_at)
            )}
        where id = ${row.session_id}::uuid
      `;
        await appendSessionAudit(
          tx,
          row,
          "SESSION_ROTATED",
          "SUCCEEDED",
          input.now,
          { generation: row.generation + 1 }
        );
        return {
          ok: true,
          value: {
            sessionId: String(row.session_id),
            sessionToken: nextSessionToken,
            csrfToken: nextCsrfToken,
            expiresAt: toDate(row.session_expires_at).toISOString()
          }
        };
      }
    );
    return unwrap(outcome);
  }

  async revoke(input: RevokeSessionInput): Promise<void> {
    assertOpaqueToken(input.sessionToken, "INVALID_SESSION");
    assertOpaqueToken(input.csrfToken, "CSRF_VALIDATION_FAILED");
    const tokenHash = hashSecret(input.sessionToken);
    const csrfHash = hashSecret(input.csrfToken);
    const outcome = await this.#sql.begin(
      async (tx): Promise<OperationOutcome<void>> => {
        await setIdentityRuntimeRole(tx);
        const rows = await tx<CredentialRow[]>`
        select
          c.state as credential_state,
          c.csrf_hash,
          c.generation,
          c.expires_at as credential_expires_at,
          s.id as session_id,
          s.tenant_id,
          s.actor_id,
          s.issuer,
          s.subject,
          s.state as session_state,
          s.mfa_method,
          s.mfa_verified_at,
          s.mfa_expires_at,
          s.issued_at,
          s.expires_at as session_expires_at,
          s.idle_expires_at
        from auth_session_credentials c
        join auth_sessions s on s.id = c.session_id
        where c.token_hash = ${tokenHash}
        for update of c, s
      `;
        const row = rows[0];
        if (!row) return failure("INVALID_SESSION");
        if (row.credential_state === "ROTATED") {
          await compromiseSession(tx, row.session_id, input.now);
          await appendSessionAudit(
            tx,
            row,
            "SESSION_REPLAY_BLOCKED",
            "BLOCKED",
            input.now,
            { generation: row.generation }
          );
          return failure("SESSION_REPLAY_DETECTED");
        }
        if (
          row.credential_state !== "ACTIVE" ||
          row.session_state !== "ACTIVE"
        ) {
          return failure("SESSION_REVOKED");
        }
        const temporalFailure = sessionTemporalFailure(row, input.now);
        if (temporalFailure) {
          await expireSession(tx, row.session_id, input.now);
          await appendSessionAudit(
            tx,
            row,
            timeoutAuditEvent(temporalFailure),
            "EXPIRED",
            input.now,
            { reason: temporalFailure.toLocaleLowerCase("en-US") }
          );
          return failure(temporalFailure);
        }
        if (!constantTimeDigestEqual(row.csrf_hash, csrfHash)) {
          await appendSessionAudit(
            tx,
            row,
            "SESSION_CSRF_BLOCKED",
            "BLOCKED",
            input.now,
            { operation: "revoke" }
          );
          return failure("CSRF_VALIDATION_FAILED");
        }
        await tx`
        update auth_sessions
        set state = 'REVOKED', revoked_at = ${input.now}, last_seen_at = ${input.now}
        where id = ${row.session_id}::uuid
      `;
        await tx`
        update auth_session_credentials
        set state = 'REVOKED', consumed_at = coalesce(consumed_at, ${input.now})
        where session_id = ${row.session_id}::uuid
          and state = 'ACTIVE'
      `;
        await appendSessionAudit(
          tx,
          row,
          "SESSION_REVOKED",
          "SUCCEEDED",
          input.now,
          { generation: row.generation }
        );
        return { ok: true, value: undefined };
      }
    );
    unwrap(outcome);
  }

  #nextIdleExpiry(now: Date, absoluteExpiry: Date): Date {
    return new Date(
      Math.min(absoluteExpiry.getTime(), now.getTime() + this.#idleTimeoutMs)
    );
  }
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "ascii").digest("hex");
}

function hashIdentitySubject(issuer: string, subject: string): string {
  return createHash("sha256")
    .update(issuer, "utf8")
    .update("\0", "utf8")
    .update(subject, "utf8")
    .digest("hex");
}

function assertOpaqueToken(value: string, code: SessionFailureCode): void {
  if (!opaqueTokenPattern.test(value)) throw new AuthenticationError(code);
}

function constantTimeDigestEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "ascii");
  const rightBuffer = Buffer.from(right, "ascii");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function failure<T = never>(code: SessionFailureCode): OperationOutcome<T> {
  return { ok: false, code };
}

function unwrap<T>(outcome: OperationOutcome<T>): T {
  if (!outcome.ok) throw new AuthenticationError(outcome.code);
  return outcome.value;
}

function sessionTemporalFailure(
  row: CredentialRow,
  now: Date
): "SESSION_EXPIRED" | "SESSION_IDLE_TIMEOUT" | "MFA_EXPIRED" | null {
  const nowMs = now.getTime();
  if (
    toDate(row.credential_expires_at).getTime() <= nowMs ||
    toDate(row.session_expires_at).getTime() <= nowMs
  ) {
    return "SESSION_EXPIRED";
  }
  if (toDate(row.idle_expires_at).getTime() <= nowMs) {
    return "SESSION_IDLE_TIMEOUT";
  }
  if (toDate(row.mfa_expires_at).getTime() <= nowMs) return "MFA_EXPIRED";
  return null;
}

function sessionFromRow(row: CredentialRow): VerifiedSession {
  return verifiedSessionSchema.parse({
    source: "SERVER_VERIFIED_SESSION",
    sessionId: String(row.session_id),
    actorId: String(row.actor_id),
    activeTenantId: String(row.tenant_id),
    issuedAt: toDate(row.issued_at).toISOString(),
    expiresAt: toDate(row.session_expires_at).toISOString(),
    mfa: {
      method: String(row.mfa_method),
      verifiedAt: toDate(row.mfa_verified_at).toISOString(),
      expiresAt: toDate(row.mfa_expires_at).toISOString()
    }
  });
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function timeoutAuditEvent(
  code: "SESSION_EXPIRED" | "SESSION_IDLE_TIMEOUT" | "MFA_EXPIRED"
): SecurityAuditEventInput["eventType"] {
  if (code === "MFA_EXPIRED") return "SESSION_MFA_EXPIRED";
  return code;
}

async function appendSessionAudit(
  transaction: postgres.TransactionSql,
  row: CredentialRow,
  eventType: SecurityAuditEventInput["eventType"],
  outcome: SecurityAuditEventInput["outcome"],
  occurredAt: Date,
  details: Record<string, string | number | boolean | null>
): Promise<void> {
  await appendSecurityAudit(transaction, {
    eventType,
    outcome,
    occurredAt,
    tenantId: String(row.tenant_id),
    actorId: String(row.actor_id),
    sessionId: String(row.session_id),
    subjectHash: hashIdentitySubject(row.issuer, row.subject),
    details
  });
}

async function compromiseSession(
  tx: postgres.TransactionSql,
  sessionId: string,
  now: Date
): Promise<void> {
  await tx`
    update auth_sessions
    set state = 'COMPROMISED', revoked_at = ${now}, last_seen_at = ${now}
    where id = ${sessionId}::uuid
      and state <> 'EXPIRED'
  `;
  await tx`
    update auth_session_credentials
    set state = 'REVOKED', consumed_at = coalesce(consumed_at, ${now})
    where session_id = ${sessionId}::uuid
      and state = 'ACTIVE'
  `;
}

async function expireSession(
  tx: postgres.TransactionSql,
  sessionId: string,
  now: Date
): Promise<void> {
  await tx`
    update auth_sessions
    set state = 'EXPIRED', revoked_at = ${now}
    where id = ${sessionId}::uuid
      and state = 'ACTIVE'
  `;
  await tx`
    update auth_session_credentials
    set state = 'REVOKED', consumed_at = coalesce(consumed_at, ${now})
    where session_id = ${sessionId}::uuid
      and state = 'ACTIVE'
  `;
}
