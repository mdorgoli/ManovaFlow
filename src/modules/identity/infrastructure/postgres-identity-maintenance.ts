import { createHash } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import type { SecurityAuditEventInput } from "../application/security-audit-port";
import { setIdentityRuntimeRole } from "./identity-database";
import { appendSecurityAudit } from "./postgres-security-audit";

const cleanupInputSchema = z.strictObject({
  now: z.date().refine((value) => Number.isFinite(value.getTime())),
  batchSize: z.number().int().min(1).max(1_000),
  retentionSeconds: z.number().int().min(60).max(31_536_000)
});

interface MaintenanceSessionRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  issuer: string;
  subject: string;
  expires_at: Date | string;
  idle_expires_at: Date | string;
  mfa_expires_at: Date | string;
}

export interface IdentityCleanupInput {
  now: Date;
  batchSize: number;
  retentionSeconds: number;
}

export interface IdentityCleanupResult {
  expiredSessions: number;
  purgedSessions: number;
  oidcDigestsDeleted: number;
  rateBucketsDeleted: number;
}

export class PostgresIdentityMaintenance {
  readonly #sql: Sql;

  constructor(sql: Sql) {
    this.#sql = sql;
  }

  async cleanup(rawInput: IdentityCleanupInput): Promise<IdentityCleanupResult> {
    const parsed = cleanupInputSchema.safeParse(rawInput);
    if (!parsed.success) throw new Error("Identity cleanup input is invalid");
    const input = parsed.data;
    const retentionCutoff = new Date(
      input.now.getTime() - input.retentionSeconds * 1_000
    );

    return this.#sql.begin(async (transaction) => {
      await setIdentityRuntimeRole(transaction);
      const expired = await expireStaleSessions(
        transaction,
        input.now,
        input.batchSize
      );
      const purged = await purgeTerminalSessions(
        transaction,
        input.now,
        retentionCutoff,
        input.batchSize,
        input.retentionSeconds
      );
      const oidcDigests = await transaction<{ token_hash: string }[]>`
        with candidates as (
          select token_hash
          from consumed_oidc_tokens
          where expires_at <= ${input.now}
          order by expires_at, token_hash
          for update skip locked
          limit ${input.batchSize}
        )
        delete from consumed_oidc_tokens consumed
        using candidates
        where consumed.token_hash = candidates.token_hash
        returning consumed.token_hash
      `;
      const rateBuckets = await transaction<
        { operation: string; key_hash: string }[]
      >`
        with candidates as (
          select operation, key_hash
          from auth_rate_limit_buckets
          where updated_at < ${retentionCutoff}
            and (blocked_until is null or blocked_until <= ${input.now})
          order by updated_at, operation, key_hash
          for update skip locked
          limit ${input.batchSize}
        )
        delete from auth_rate_limit_buckets buckets
        using candidates
        where buckets.operation = candidates.operation
          and buckets.key_hash = candidates.key_hash
        returning buckets.operation, buckets.key_hash
      `;

      return {
        expiredSessions: expired.length,
        purgedSessions: purged.length,
        oidcDigestsDeleted: oidcDigests.length,
        rateBucketsDeleted: rateBuckets.length
      };
    });
  }
}

async function expireStaleSessions(
  transaction: TransactionSql,
  now: Date,
  batchSize: number
): Promise<MaintenanceSessionRow[]> {
  const rows = await transaction<MaintenanceSessionRow[]>`
    with candidates as (
      select id
      from auth_sessions
      where state = 'ACTIVE'
        and (
          expires_at <= ${now}
          or idle_expires_at <= ${now}
          or mfa_expires_at <= ${now}
        )
      order by least(expires_at, idle_expires_at, mfa_expires_at), id
      for update skip locked
      limit ${batchSize}
    )
    update auth_sessions sessions
    set state = 'EXPIRED',
        revoked_at = ${now}
    from candidates
    where sessions.id = candidates.id
    returning
      sessions.id,
      sessions.tenant_id,
      sessions.actor_id,
      sessions.issuer,
      sessions.subject,
      sessions.expires_at,
      sessions.idle_expires_at,
      sessions.mfa_expires_at
  `;
  if (rows.length === 0) return rows;

  await transaction`
    update auth_session_credentials
    set state = 'REVOKED',
        consumed_at = coalesce(consumed_at, ${now})
    where session_id in ${transaction(rows.map((row) => row.id))}
      and state = 'ACTIVE'
  `;
  for (const row of rows) {
    await appendMaintenanceAudit(
      transaction,
      row,
      expirationEvent(row, now),
      "EXPIRED",
      now,
      { reason: "maintenance_sweep" }
    );
  }
  return rows;
}

async function purgeTerminalSessions(
  transaction: TransactionSql,
  now: Date,
  retentionCutoff: Date,
  batchSize: number,
  retentionSeconds: number
): Promise<MaintenanceSessionRow[]> {
  const rows = await transaction<MaintenanceSessionRow[]>`
    select
      id,
      tenant_id,
      actor_id,
      issuer,
      subject,
      expires_at,
      idle_expires_at,
      mfa_expires_at
    from auth_sessions
    where state <> 'ACTIVE'
      and coalesce(revoked_at, expires_at) < ${retentionCutoff}
    order by coalesce(revoked_at, expires_at), id
    for update skip locked
    limit ${batchSize}
  `;
  for (const row of rows) {
    await appendMaintenanceAudit(
      transaction,
      row,
      "SESSION_PURGED",
      "PURGED",
      now,
      { retentionSeconds }
    );
  }
  if (rows.length > 0) {
    await transaction`
      delete from auth_sessions
      where id in ${transaction(rows.map((row) => row.id))}
    `;
  }
  return rows;
}

function expirationEvent(
  row: MaintenanceSessionRow,
  now: Date
): SecurityAuditEventInput["eventType"] {
  const nowMs = now.getTime();
  if (toDate(row.expires_at).getTime() <= nowMs) return "SESSION_EXPIRED";
  if (toDate(row.idle_expires_at).getTime() <= nowMs) {
    return "SESSION_IDLE_TIMEOUT";
  }
  return "SESSION_MFA_EXPIRED";
}

async function appendMaintenanceAudit(
  transaction: TransactionSql,
  row: MaintenanceSessionRow,
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
    sessionId: String(row.id),
    subjectHash: createHash("sha256")
      .update(row.issuer, "utf8")
      .update("\0", "utf8")
      .update(row.subject, "utf8")
      .digest("hex"),
    details
  });
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
