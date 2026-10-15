import type postgres from "postgres";
import { getApplicationDatabaseRole } from "@/lib/database";
import type { CandidateInput } from "../domain/candidate-schema";
import type {
  ActorContext,
  LaneKey,
  MarketKey,
  PackState
} from "../domain/types";
import type { CandidateScore, ScoreExplanation } from "../domain/scoring";
import type { MarketScore } from "../domain/market-scoring";
import {
  normalizeDomain,
  type AuditEvent,
  type CompanyRecord,
  type CompanyScoreRecord,
  type ComplianceDecisionRecord,
  type DashboardSnapshot,
  type DraftDecision,
  type DraftRecord,
  type GrowthRepository,
  type MarketScoreRecord,
  type ResearchRunRecord,
  type ResearchRunStatus,
  type SuppressionRecord
} from "../application/repository";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;
type DbRow = Record<string, unknown>;

export class PostgresGrowthRepository implements GrowthRepository {
  readonly #sql: Sql;
  readonly #databaseRole: string;

  constructor(sql: Sql) {
    this.#sql = sql;
    this.#databaseRole = getApplicationDatabaseRole();
  }

  async beginRun(
    actor: ActorContext,
    laneKey: LaneKey,
    idempotencyKey: string
  ): Promise<{ run: ResearchRunRecord; reused: boolean }> {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) throw new Error("Idempotency key is required");

    return this.#withTenant(actor, async (tx) => {
      const inserted = await tx<DbRow[]>`
        insert into research_runs (tenant_id, lane_key, idempotency_key, status)
        values (${actor.tenantId}::uuid, ${laneKey}, ${normalizedKey}, 'RUNNING')
        on conflict (tenant_id, lane_key, idempotency_key) do nothing
        returning *
      `;
      const row = inserted[0];
      if (row) return { run: mapRun(row), reused: false };

      const existing = await tx<DbRow[]>`
        select * from research_runs
        where tenant_id = ${actor.tenantId}::uuid
          and lane_key = ${laneKey}
          and idempotency_key = ${normalizedKey}
        limit 1
      `;
      if (!existing[0]) throw new Error("Idempotent research run disappeared");
      return { run: mapRun(existing[0]), reused: true };
    });
  }

  async completeRun(
    actor: ActorContext,
    runId: string,
    summary: Record<string, unknown>
  ): Promise<ResearchRunRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        update research_runs
        set status = 'COMPLETED', completed_at = now(), error = null,
            summary = ${tx.json(summary as postgres.JSONValue)}
        where id = ${runId}::uuid and tenant_id = ${actor.tenantId}::uuid
        returning *
      `;
      return mapRequired(rows[0], mapRun, "Research run not found");
    });
  }

  async failRun(
    actor: ActorContext,
    runId: string,
    error: string
  ): Promise<ResearchRunRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        update research_runs
        set status = 'FAILED', completed_at = now(), error = ${error.slice(0, 1_000)}, summary = null
        where id = ${runId}::uuid and tenant_id = ${actor.tenantId}::uuid
        returning *
      `;
      return mapRequired(rows[0], mapRun, "Research run not found");
    });
  }

  async findCompany(
    actor: ActorContext,
    domain: string
  ): Promise<CompanyRecord | null> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        select * from companies
        where tenant_id = ${actor.tenantId}::uuid
          and normalized_domain = ${normalizeDomain(domain)}
        limit 1
      `;
      return rows[0] ? mapCompany(rows[0]) : null;
    });
  }

  async saveCompany(
    actor: ActorContext,
    candidate: CandidateInput
  ): Promise<{ company: CompanyRecord; created: boolean }> {
    return this.#withTenant(actor, async (tx) => {
      const normalizedDomain = normalizeDomain(candidate.domain);
      const inserted = await tx<DbRow[]>`
        insert into companies (
          tenant_id, company_name, domain, normalized_domain, country,
          source_url, source_kind, synthetic
        ) values (
          ${actor.tenantId}::uuid, ${candidate.companyName}, ${candidate.domain},
          ${normalizedDomain}, ${candidate.country}, ${candidate.sourceUrl},
          ${candidate.sourceKind}, ${candidate.synthetic}
        )
        on conflict (tenant_id, normalized_domain) do nothing
        returning *
      `;
      if (inserted[0]) {
        return { company: mapCompany(inserted[0]), created: true };
      }
      const existing = await tx<DbRow[]>`
        select * from companies
        where tenant_id = ${actor.tenantId}::uuid
          and normalized_domain = ${normalizedDomain}
        limit 1
      `;
      return {
        company: mapRequired(existing[0], mapCompany, "Company upsert failed"),
        created: false
      };
    });
  }

  async suppressDomain(
    actor: ActorContext,
    domain: string,
    reason: string
  ): Promise<SuppressionRecord> {
    const normalizedDomain = normalizeDomain(domain);
    const cleanReason = reason.trim().slice(0, 500);
    if (!cleanReason) throw new Error("Suppression reason is required");

    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        insert into suppressions (tenant_id, normalized_domain, reason)
        values (${actor.tenantId}::uuid, ${normalizedDomain}, ${cleanReason})
        on conflict (tenant_id, normalized_domain)
        do update set normalized_domain = excluded.normalized_domain
        returning *
      `;
      return mapRequired(rows[0], mapSuppression, "Suppression upsert failed");
    });
  }

  async isSuppressed(actor: ActorContext, domain: string): Promise<boolean> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<{ found: boolean }[]>`
        select exists(
          select 1 from suppressions
          where tenant_id = ${actor.tenantId}::uuid
            and normalized_domain = ${normalizeDomain(domain)}
        ) as found
      `;
      return rows[0]?.found === true;
    });
  }

  async saveCompanyScore(
    actor: ActorContext,
    input: Omit<CompanyScoreRecord, "id" | "tenantId" | "createdAt">
  ): Promise<CompanyScoreRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        insert into company_scores (
          tenant_id, run_id, company_id, lane_key, total, status, explanation
        ) values (
          ${actor.tenantId}::uuid, ${input.runId}::uuid, ${input.companyId}::uuid,
          ${input.laneKey}, ${input.total}, ${input.status},
          ${JSON.stringify(input.explanation)}::jsonb
        )
        on conflict (tenant_id, run_id, company_id, lane_key)
        do update set total = company_scores.total
        returning *
      `;
      return mapRequired(
        rows[0],
        mapCompanyScore,
        "Company score upsert failed"
      );
    });
  }

  async saveMarketScore(
    actor: ActorContext,
    input: Omit<MarketScoreRecord, "id" | "tenantId" | "createdAt">
  ): Promise<MarketScoreRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        insert into market_scores (
          tenant_id, run_id, lane_key, market_key, total, confidence, explanation
        ) values (
          ${actor.tenantId}::uuid, ${input.runId}::uuid, ${input.laneKey},
          ${input.marketKey}, ${input.total}, ${input.confidence},
          ${JSON.stringify(input.explanation)}::jsonb
        )
        on conflict (tenant_id, run_id, lane_key, market_key)
        do update set total = market_scores.total
        returning *
      `;
      return mapRequired(rows[0], mapMarketScore, "Market score upsert failed");
    });
  }

  async saveComplianceDecision(
    actor: ActorContext,
    input: Omit<ComplianceDecisionRecord, "id" | "tenantId">
  ): Promise<ComplianceDecisionRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        insert into compliance_decisions (
          tenant_id, decision_key, lane_key, market_key, target_stage,
          status, authorization_token, recorded_at
        ) values (
          ${actor.tenantId}::uuid, ${input.decisionKey}, ${input.laneKey},
          ${input.marketKey}, ${input.targetStage}, ${input.status},
          ${input.authorizationToken}, ${input.recordedAt}::timestamptz
        )
        on conflict (tenant_id, decision_key) do nothing
        returning *
      `;
      if (!rows[0]) {
        throw new Error("Compliance decision is immutable and already exists");
      }
      return mapComplianceDecision(rows[0]);
    });
  }

  async findComplianceDecision(
    actor: ActorContext,
    decisionKey: string
  ): Promise<ComplianceDecisionRecord | null> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        select * from compliance_decisions
        where tenant_id = ${actor.tenantId}::uuid
          and decision_key = ${decisionKey}
        limit 1
      `;
      return rows[0] ? mapComplianceDecision(rows[0]) : null;
    });
  }

  async saveDraft(
    actor: ActorContext,
    input: Omit<
      DraftRecord,
      | "id"
      | "tenantId"
      | "decision"
      | "decidedBy"
      | "createdAt"
      | "decidedAt"
      | "outboundEnabled"
    >
  ): Promise<DraftRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        insert into drafts (
          tenant_id, run_id, company_id, lane_key, pack_state, kind,
          subject, body, synthetic, outbound_enabled
        ) values (
          ${actor.tenantId}::uuid, ${input.runId}::uuid, ${input.companyId}::uuid,
          ${input.laneKey}, ${input.packState}, ${input.kind}, ${input.subject},
          ${input.body}, ${input.synthetic}, false
        )
        on conflict (tenant_id, run_id, company_id, lane_key)
        do update set outbound_enabled = false
        returning *
      `;
      return mapRequired(rows[0], mapDraft, "Draft upsert failed");
    });
  }

  async decideDraft(
    actor: ActorContext,
    draftId: string,
    decision: Exclude<DraftDecision, "PENDING">
  ): Promise<DraftRecord> {
    return this.#withTenant(actor, async (tx) => {
      const rows = await tx<DbRow[]>`
        update drafts
        set decision = ${decision}, decided_by = ${actor.actorId}::uuid,
            decided_at = now(), outbound_enabled = false
        where id = ${draftId}::uuid
          and tenant_id = ${actor.tenantId}::uuid
          and decision = 'PENDING'
        returning *
      `;
      return mapRequired(
        rows[0],
        mapDraft,
        "Draft not found or decision is final"
      );
    });
  }

  async appendAudit(
    actor: ActorContext,
    input: {
      eventType: string;
      laneKey: LaneKey | null;
      entityId: string;
      details: Record<string, unknown>;
    }
  ): Promise<AuditEvent> {
    return this.#withTenant(actor, async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${actor.tenantId}))`;
      const rows = await tx<DbRow[]>`
        insert into audit_events (
          tenant_id, sequence, event_type, lane_key, entity_id, actor_id, details
        ) values (
          ${actor.tenantId}::uuid,
          (select coalesce(max(sequence), 0) + 1 from audit_events where tenant_id = ${actor.tenantId}::uuid),
          ${input.eventType}, ${input.laneKey}, ${input.entityId},
          ${actor.actorId}::uuid, ${JSON.stringify(input.details)}::jsonb
        )
        returning *
      `;
      return mapRequired(rows[0], mapAudit, "Audit append failed");
    });
  }

  async getDashboard(actor: ActorContext): Promise<DashboardSnapshot> {
    return this.#withTenant(actor, async (tx) => {
      const runs = await tx<
        DbRow[]
      >`select * from research_runs order by started_at desc`;
      const companies = await tx<
        DbRow[]
      >`select * from companies order by created_at desc`;
      const companyScores = await tx<
        DbRow[]
      >`select * from company_scores order by created_at desc`;
      const marketScores = await tx<
        DbRow[]
      >`select * from market_scores order by created_at desc`;
      const compliance = await tx<
        DbRow[]
      >`select * from compliance_decisions order by recorded_at desc`;
      const drafts = await tx<
        DbRow[]
      >`select * from drafts order by created_at desc`;
      const suppressions = await tx<
        DbRow[]
      >`select * from suppressions order by created_at desc`;
      const audit = await tx<
        DbRow[]
      >`select * from audit_events order by sequence`;

      return {
        runs: runs.map(mapRun),
        companies: companies.map(mapCompany),
        companyScores: companyScores.map(mapCompanyScore),
        marketScores: marketScores.map(mapMarketScore),
        complianceDecisions: compliance.map(mapComplianceDecision),
        drafts: drafts.map(mapDraft),
        suppressions: suppressions.map(mapSuppression),
        audit: audit.map(mapAudit)
      };
    });
  }

  async #withTenant<T>(
    actor: ActorContext,
    operation: (tx: TransactionSql) => Promise<T>
  ): Promise<T> {
    return (await this.#sql.begin(async (tx) => {
      await tx`set local role ${tx(this.#databaseRole)}`;
      await tx`select set_config('app.tenant_id', ${actor.tenantId}, true)`;
      return operation(tx);
    })) as unknown as T;
  }
}

function mapRun(row: DbRow): ResearchRunRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    laneKey: row.lane_key as LaneKey,
    idempotencyKey: text(row.idempotency_key),
    status: row.status as ResearchRunStatus,
    startedAt: iso(row.started_at),
    completedAt: nullableIso(row.completed_at),
    error: nullableText(row.error),
    summary:
      row.summary === null || row.summary === undefined
        ? null
        : json<Record<string, unknown>>(row.summary)
  };
}

function mapCompany(row: DbRow): CompanyRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    companyName: text(row.company_name),
    domain: text(row.domain),
    normalizedDomain: text(row.normalized_domain),
    country: text(row.country),
    sourceUrl: text(row.source_url),
    sourceKind: row.source_kind as CandidateInput["sourceKind"],
    synthetic: row.synthetic === true,
    createdAt: iso(row.created_at)
  };
}

function mapCompanyScore(row: DbRow): CompanyScoreRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    runId: text(row.run_id),
    companyId: text(row.company_id),
    laneKey: row.lane_key as LaneKey,
    total: number(row.total),
    status: row.status as CandidateScore["status"],
    explanation: json<ScoreExplanation[]>(row.explanation),
    createdAt: iso(row.created_at)
  };
}

function mapMarketScore(row: DbRow): MarketScoreRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    runId: text(row.run_id),
    laneKey: row.lane_key as LaneKey,
    marketKey: row.market_key as MarketKey,
    total: number(row.total),
    confidence: row.confidence as MarketScore["confidence"],
    explanation: json<ScoreExplanation[]>(row.explanation),
    createdAt: iso(row.created_at)
  };
}

function mapComplianceDecision(row: DbRow): ComplianceDecisionRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    decisionKey: text(row.decision_key),
    laneKey: row.lane_key as LaneKey,
    marketKey: row.market_key as MarketKey,
    targetStage: row.target_stage as "RESEARCH_ONLY" | "HUMAN_SEND",
    status: text(row.status),
    authorizationToken: nullableText(row.authorization_token),
    recordedAt: iso(row.recorded_at)
  };
}

function mapDraft(row: DbRow): DraftRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    runId: text(row.run_id),
    companyId: text(row.company_id),
    laneKey: row.lane_key as LaneKey,
    packState: row.pack_state as PackState,
    kind: row.kind as DraftRecord["kind"],
    subject: text(row.subject),
    body: text(row.body),
    synthetic: row.synthetic === true,
    decision: row.decision as DraftDecision,
    decidedBy: nullableText(row.decided_by),
    createdAt: iso(row.created_at),
    decidedAt: nullableIso(row.decided_at),
    outboundEnabled: false
  };
}

function mapSuppression(row: DbRow): SuppressionRecord {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    normalizedDomain: text(row.normalized_domain),
    reason: text(row.reason),
    createdAt: iso(row.created_at)
  };
}

function mapAudit(row: DbRow): AuditEvent {
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id),
    sequence: number(row.sequence),
    eventType: text(row.event_type),
    laneKey: row.lane_key === null ? null : (row.lane_key as LaneKey),
    entityId: text(row.entity_id),
    actorId: text(row.actor_id),
    details: json<Record<string, unknown>>(row.details),
    createdAt: iso(row.created_at)
  };
}

function mapRequired<T>(
  row: DbRow | undefined,
  mapper: (value: DbRow) => T,
  message: string
): T {
  if (!row) throw new Error(message);
  return mapper(row);
}

function text(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Unexpected database text value");
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function number(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error("Unexpected database numeric value");
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new Error("Unexpected database timestamp value");
}

function nullableIso(value: unknown): string | null {
  return value === null || value === undefined ? null : iso(value);
}

function json<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
