import { randomUUID } from "node:crypto";
import type { CandidateInput } from "../domain/candidate-schema";
import type { ActorContext, LaneKey } from "../domain/types";
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
  type SuppressionRecord
} from "../application/repository";

interface InMemoryOptions {
  now?: () => Date;
  id?: () => string;
}

export class InMemoryGrowthRepository implements GrowthRepository {
  readonly #now: () => Date;
  readonly #id: () => string;
  readonly #runs = new Map<string, ResearchRunRecord>();
  readonly #companies = new Map<string, CompanyRecord>();
  readonly #companyScores: CompanyScoreRecord[] = [];
  readonly #marketScores: MarketScoreRecord[] = [];
  readonly #compliance = new Map<string, ComplianceDecisionRecord>();
  readonly #drafts = new Map<string, DraftRecord>();
  readonly #suppressions = new Map<string, SuppressionRecord>();
  readonly #audit: AuditEvent[] = [];

  constructor(options: InMemoryOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#id = options.id ?? randomUUID;
  }

  async beginRun(
    actor: ActorContext,
    laneKey: LaneKey,
    idempotencyKey: string
  ): Promise<{ run: ResearchRunRecord; reused: boolean }> {
    const normalizedKey = idempotencyKey.trim();
    if (!normalizedKey) {
      throw new Error("Idempotency key is required");
    }
    const key = runKey(actor.tenantId, laneKey, normalizedKey);
    const existing = this.#runs.get(key);
    if (existing) {
      return { run: clone(existing), reused: true };
    }

    const run: ResearchRunRecord = {
      id: this.#id(),
      tenantId: actor.tenantId,
      laneKey,
      idempotencyKey: normalizedKey,
      status: "RUNNING",
      startedAt: this.#now().toISOString(),
      completedAt: null,
      error: null,
      summary: null
    };
    this.#runs.set(key, clone(run));
    return { run: clone(run), reused: false };
  }

  async completeRun(
    actor: ActorContext,
    runId: string,
    summary: Record<string, unknown>
  ): Promise<ResearchRunRecord> {
    return this.#updateRun(actor, runId, {
      status: "COMPLETED",
      completedAt: this.#now().toISOString(),
      error: null,
      summary: clone(summary)
    });
  }

  async failRun(
    actor: ActorContext,
    runId: string,
    error: string
  ): Promise<ResearchRunRecord> {
    return this.#updateRun(actor, runId, {
      status: "FAILED",
      completedAt: this.#now().toISOString(),
      error: error.slice(0, 1_000),
      summary: null
    });
  }

  async findCompany(
    actor: ActorContext,
    domain: string
  ): Promise<CompanyRecord | null> {
    const found = this.#companies.get(
      companyKey(actor.tenantId, normalizeDomain(domain))
    );
    return found ? clone(found) : null;
  }

  async saveCompany(
    actor: ActorContext,
    candidate: CandidateInput
  ): Promise<{ company: CompanyRecord; created: boolean }> {
    const normalizedDomain = normalizeDomain(candidate.domain);
    const key = companyKey(actor.tenantId, normalizedDomain);
    const existing = this.#companies.get(key);
    if (existing) {
      return { company: clone(existing), created: false };
    }

    const company: CompanyRecord = {
      id: this.#id(),
      tenantId: actor.tenantId,
      companyName: candidate.companyName,
      domain: candidate.domain,
      normalizedDomain,
      country: candidate.country,
      sourceUrl: candidate.sourceUrl,
      sourceKind: candidate.sourceKind,
      synthetic: candidate.synthetic,
      createdAt: this.#now().toISOString()
    };
    this.#companies.set(key, clone(company));
    return { company: clone(company), created: true };
  }

  async suppressDomain(
    actor: ActorContext,
    domain: string,
    reason: string
  ): Promise<SuppressionRecord> {
    const normalizedDomain = normalizeDomain(domain);
    const key = suppressionKey(actor.tenantId, normalizedDomain);
    const existing = this.#suppressions.get(key);
    if (existing) {
      return clone(existing);
    }

    const suppression: SuppressionRecord = {
      id: this.#id(),
      tenantId: actor.tenantId,
      normalizedDomain,
      reason: reason.trim().slice(0, 500),
      createdAt: this.#now().toISOString()
    };
    this.#suppressions.set(key, clone(suppression));
    return clone(suppression);
  }

  async isSuppressed(actor: ActorContext, domain: string): Promise<boolean> {
    return this.#suppressions.has(
      suppressionKey(actor.tenantId, normalizeDomain(domain))
    );
  }

  async saveCompanyScore(
    actor: ActorContext,
    input: Omit<CompanyScoreRecord, "id" | "tenantId" | "createdAt">
  ): Promise<CompanyScoreRecord> {
    const existing = this.#companyScores.find(
      (record) =>
        record.tenantId === actor.tenantId &&
        record.runId === input.runId &&
        record.companyId === input.companyId &&
        record.laneKey === input.laneKey
    );
    if (existing) return clone(existing);
    const record: CompanyScoreRecord = {
      ...clone(input),
      id: this.#id(),
      tenantId: actor.tenantId,
      createdAt: this.#now().toISOString()
    };
    this.#companyScores.push(clone(record));
    return clone(record);
  }

  async saveMarketScore(
    actor: ActorContext,
    input: Omit<MarketScoreRecord, "id" | "tenantId" | "createdAt">
  ): Promise<MarketScoreRecord> {
    const existing = this.#marketScores.find(
      (record) =>
        record.tenantId === actor.tenantId &&
        record.runId === input.runId &&
        record.laneKey === input.laneKey &&
        record.marketKey === input.marketKey
    );
    if (existing) return clone(existing);
    const record: MarketScoreRecord = {
      ...clone(input),
      id: this.#id(),
      tenantId: actor.tenantId,
      createdAt: this.#now().toISOString()
    };
    this.#marketScores.push(clone(record));
    return clone(record);
  }

  async saveComplianceDecision(
    actor: ActorContext,
    input: Omit<ComplianceDecisionRecord, "id" | "tenantId">
  ): Promise<ComplianceDecisionRecord> {
    const key = complianceKey(actor.tenantId, input.decisionKey);
    if (this.#compliance.has(key)) {
      throw new Error("Compliance decision is immutable and already exists");
    }
    const record: ComplianceDecisionRecord = {
      ...clone(input),
      id: this.#id(),
      tenantId: actor.tenantId
    };
    this.#compliance.set(key, clone(record));
    return clone(record);
  }

  async findComplianceDecision(
    actor: ActorContext,
    decisionKey: string
  ): Promise<ComplianceDecisionRecord | null> {
    const record = this.#compliance.get(
      complianceKey(actor.tenantId, decisionKey)
    );
    return record ? clone(record) : null;
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
    const existing = [...this.#drafts.values()].find(
      (record) =>
        record.tenantId === actor.tenantId &&
        record.runId === input.runId &&
        record.companyId === input.companyId &&
        record.laneKey === input.laneKey
    );
    if (existing) return clone(existing);
    const record: DraftRecord = {
      ...clone(input),
      id: this.#id(),
      tenantId: actor.tenantId,
      decision: "PENDING",
      decidedBy: null,
      createdAt: this.#now().toISOString(),
      decidedAt: null,
      outboundEnabled: false
    };
    this.#drafts.set(record.id, clone(record));
    return clone(record);
  }

  async decideDraft(
    actor: ActorContext,
    draftId: string,
    decision: Exclude<DraftDecision, "PENDING">
  ): Promise<DraftRecord> {
    const stored = this.#drafts.get(draftId);
    if (!stored || stored.tenantId !== actor.tenantId) {
      throw new Error("Draft not found");
    }
    if (stored.decision !== "PENDING") {
      throw new Error("Draft decision is final");
    }
    const updated: DraftRecord = {
      ...stored,
      decision,
      decidedBy: actor.actorId,
      decidedAt: this.#now().toISOString(),
      outboundEnabled: false
    };
    this.#drafts.set(draftId, clone(updated));
    return clone(updated);
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
    const event: AuditEvent = {
      id: this.#id(),
      tenantId: actor.tenantId,
      sequence:
        this.#audit.filter((item) => item.tenantId === actor.tenantId).length + 1,
      eventType: input.eventType,
      laneKey: input.laneKey,
      entityId: input.entityId,
      actorId: actor.actorId,
      details: clone(input.details),
      createdAt: this.#now().toISOString()
    };
    this.#audit.push(clone(event));
    return clone(event);
  }

  async getDashboard(actor: ActorContext): Promise<DashboardSnapshot> {
    const tenantId = actor.tenantId;
    return clone({
      runs: [...this.#runs.values()].filter((item) => item.tenantId === tenantId),
      companies: [...this.#companies.values()].filter((item) => item.tenantId === tenantId),
      companyScores: this.#companyScores.filter((item) => item.tenantId === tenantId),
      marketScores: this.#marketScores.filter((item) => item.tenantId === tenantId),
      complianceDecisions: [...this.#compliance.values()].filter((item) => item.tenantId === tenantId),
      drafts: [...this.#drafts.values()].filter((item) => item.tenantId === tenantId),
      suppressions: [...this.#suppressions.values()].filter((item) => item.tenantId === tenantId),
      audit: this.#audit
        .filter((item) => item.tenantId === tenantId)
        .sort((left, right) => left.sequence - right.sequence)
    });
  }

  #updateRun(
    actor: ActorContext,
    runId: string,
    patch: Pick<
      ResearchRunRecord,
      "status" | "completedAt" | "error" | "summary"
    >
  ): ResearchRunRecord {
    const pair = [...this.#runs.entries()].find(
      ([, run]) => run.id === runId && run.tenantId === actor.tenantId
    );
    if (!pair) {
      throw new Error("Research run not found");
    }
    const [key, run] = pair;
    const updated = { ...run, ...clone(patch) };
    this.#runs.set(key, updated);
    return clone(updated);
  }
}

function companyKey(tenantId: string, domain: string): string {
  return tenantId + ":" + domain;
}

function suppressionKey(tenantId: string, domain: string): string {
  return tenantId + ":" + domain;
}

function runKey(tenantId: string, laneKey: LaneKey, key: string): string {
  return tenantId + ":" + laneKey + ":" + key;
}

function complianceKey(tenantId: string, decisionKey: string): string {
  return tenantId + ":" + decisionKey;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
