import type { CandidateInput } from "../domain/candidate-schema";
import type {
  ActorContext,
  LaneKey,
  MarketKey,
  PackState
} from "../domain/types";
import type {
  CandidateScore,
  ScoreExplanation
} from "../domain/scoring";
import type { MarketScore } from "../domain/market-scoring";

export type ResearchRunStatus = "RUNNING" | "COMPLETED" | "FAILED";

export interface ResearchRunRecord {
  id: string;
  tenantId: string;
  laneKey: LaneKey;
  idempotencyKey: string;
  status: ResearchRunStatus;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  summary: Record<string, unknown> | null;
}

export interface CompanyRecord {
  id: string;
  tenantId: string;
  companyName: string;
  domain: string;
  normalizedDomain: string;
  country: string;
  sourceUrl: string;
  sourceKind: CandidateInput["sourceKind"];
  synthetic: boolean;
  createdAt: string;
}

export interface CompanyScoreRecord {
  id: string;
  tenantId: string;
  runId: string;
  companyId: string;
  laneKey: LaneKey;
  total: number;
  status: CandidateScore["status"];
  explanation: ScoreExplanation[];
  createdAt: string;
}

export interface MarketScoreRecord {
  id: string;
  tenantId: string;
  runId: string;
  laneKey: LaneKey;
  marketKey: MarketKey;
  total: number;
  confidence: MarketScore["confidence"];
  explanation: ScoreExplanation[];
  createdAt: string;
}

export interface ComplianceDecisionRecord {
  id: string;
  tenantId: string;
  decisionKey: string;
  laneKey: LaneKey;
  marketKey: MarketKey;
  targetStage: "RESEARCH_ONLY" | "HUMAN_SEND";
  status: string;
  authorizationToken: string | null;
  recordedAt: string;
}

export type DraftDecision = "PENDING" | "APPROVED_INTERNAL" | "REJECTED";

export interface DraftRecord {
  id: string;
  tenantId: string;
  runId: string;
  companyId: string;
  laneKey: LaneKey;
  packState: PackState;
  kind: "PRODUCT_DISCOVERY" | "WAITLIST_PREVIEW";
  subject: string;
  body: string;
  synthetic: boolean;
  decision: DraftDecision;
  decidedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
  outboundEnabled: false;
}

export interface SuppressionRecord {
  id: string;
  tenantId: string;
  normalizedDomain: string;
  reason: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  sequence: number;
  eventType: string;
  laneKey: LaneKey | null;
  entityId: string;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardSnapshot {
  runs: ResearchRunRecord[];
  companies: CompanyRecord[];
  companyScores: CompanyScoreRecord[];
  marketScores: MarketScoreRecord[];
  complianceDecisions: ComplianceDecisionRecord[];
  drafts: DraftRecord[];
  suppressions: SuppressionRecord[];
  audit: AuditEvent[];
}

export interface GrowthRepository {
  beginRun(
    actor: ActorContext,
    laneKey: LaneKey,
    idempotencyKey: string
  ): Promise<{ run: ResearchRunRecord; reused: boolean }>;
  completeRun(
    actor: ActorContext,
    runId: string,
    summary: Record<string, unknown>
  ): Promise<ResearchRunRecord>;
  failRun(
    actor: ActorContext,
    runId: string,
    error: string
  ): Promise<ResearchRunRecord>;
  findCompany(
    actor: ActorContext,
    domain: string
  ): Promise<CompanyRecord | null>;
  saveCompany(
    actor: ActorContext,
    candidate: CandidateInput
  ): Promise<{ company: CompanyRecord; created: boolean }>;
  suppressDomain(
    actor: ActorContext,
    domain: string,
    reason: string
  ): Promise<SuppressionRecord>;
  isSuppressed(actor: ActorContext, domain: string): Promise<boolean>;
  saveCompanyScore(
    actor: ActorContext,
    input: Omit<CompanyScoreRecord, "id" | "tenantId" | "createdAt">
  ): Promise<CompanyScoreRecord>;
  saveMarketScore(
    actor: ActorContext,
    input: Omit<MarketScoreRecord, "id" | "tenantId" | "createdAt">
  ): Promise<MarketScoreRecord>;
  saveComplianceDecision(
    actor: ActorContext,
    input: Omit<ComplianceDecisionRecord, "id" | "tenantId">
  ): Promise<ComplianceDecisionRecord>;
  findComplianceDecision(
    actor: ActorContext,
    decisionKey: string
  ): Promise<ComplianceDecisionRecord | null>;
  saveDraft(
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
  ): Promise<DraftRecord>;
  decideDraft(
    actor: ActorContext,
    draftId: string,
    decision: Exclude<DraftDecision, "PENDING">
  ): Promise<DraftRecord>;
  appendAudit(
    actor: ActorContext,
    input: {
      eventType: string;
      laneKey: LaneKey | null;
      entityId: string;
      details: Record<string, unknown>;
    }
  ): Promise<AuditEvent>;
  getDashboard(actor: ActorContext): Promise<DashboardSnapshot>;
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}
