import type { Sql, TransactionSql } from "postgres";
import {
  validateSecurityAuditEvent,
  type SecurityAuditEventInput,
  type SecurityAuditPort
} from "../application/security-audit-port";
import { setIdentityRuntimeRole } from "./identity-database";

export async function appendSecurityAudit(
  transaction: TransactionSql,
  rawEvent: SecurityAuditEventInput
): Promise<void> {
  const event = validateSecurityAuditEvent(rawEvent);
  await transaction`
    insert into identity_security_events (
      occurred_at,
      event_type,
      outcome,
      tenant_id,
      actor_id,
      session_id,
      subject_hash,
      request_hash,
      details
    ) values (
      ${event.occurredAt},
      ${event.eventType},
      ${event.outcome},
      ${event.tenantId ?? null}::uuid,
      ${event.actorId ?? null}::uuid,
      ${event.sessionId ?? null}::uuid,
      ${event.subjectHash ?? null},
      ${event.requestHash ?? null},
      ${transaction.json(event.details)}
    )
  `;
}

export class PostgresSecurityAuditPort implements SecurityAuditPort {
  readonly #sql: Sql;

  constructor(sql: Sql) {
    this.#sql = sql;
  }

  async append(event: SecurityAuditEventInput): Promise<void> {
    await this.#sql.begin(async (transaction) => {
      await setIdentityRuntimeRole(transaction);
      await appendSecurityAudit(transaction, event);
    });
  }
}
