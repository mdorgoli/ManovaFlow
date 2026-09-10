import type { ComplianceCategory } from "@/modules/compliance/domain/gate";
import type {
  LaneKey,
  MarketKey,
  PackState
} from "@/modules/growth/domain/types";
import type { ResearchRunStatus } from "./repository";

export const DASHBOARD_READ_MODEL_VERSION = "manovaflow.dashboard.v2" as const;

export const DASHBOARD_SECTION_VERSIONS = Object.freeze({
  safetyContext: "manovaflow.dashboard.safety-context.v2",
  laneSummary: "manovaflow.dashboard.lane-summary.v1",
  capUsage: "manovaflow.dashboard.cap-usage.v1",
  marketRanking: "manovaflow.dashboard.market-ranking.v1",
  evidenceMatrix: "manovaflow.dashboard.evidence-matrix.v1",
  safeAuditFeed: "manovaflow.dashboard.safe-audit-feed.v2"
} as const);

export type MissingReason =
  | "NO_RECORDED_RUN"
  | "NO_COMPLETED_RUN"
  | "NO_MARKET_SCORE"
  | "NO_QUALIFYING_EVIDENCE"
  | "STALE_OR_INVALID_EVIDENCE"
  | "NOT_PERSISTED"
  | "LEDGER_NOT_IMPLEMENTED"
  | "NO_AUDIT_EVENTS"
  | "UNSAFE_SOURCE_REDACTED"
  | "INVARIANT_UNVERIFIED";

export type ProvenanceBasis =
  | "CONFIG"
  | "OBSERVED"
  | "DERIVED"
  | "INVARIANT";

export type ProvenanceSource =
  | "SERVER_POLICY"
  | "VERTICAL_MANIFEST"
  | "RESEARCH_RUN"
  | "MARKET_SCORE"
  | "MARKET_PROFILE"
  | "COMPLIANCE_EVIDENCE"
  | "AUDIT_EVENT";

export interface Provenance {
  basis: ProvenanceBasis;
  source: ProvenanceSource;
  reference: string;
  recordedAt: string | null;
}

export type NonEmptyProvenance = readonly [Provenance, ...Provenance[]];

export interface PresentValue<T> {
  state: "PRESENT";
  value: T;
  provenance: NonEmptyProvenance;
}

export interface MissingValue {
  state: "MISSING";
  reason: MissingReason;
  provenance: NonEmptyProvenance;
}

export type ReadValue<T> = PresentValue<T> | MissingValue;

export type DashboardDataset = "SYNTHETIC" | "PUBLIC_RESEARCH";

export interface SafetyContextReadModelV2 {
  contractVersion: typeof DASHBOARD_SECTION_VERSIONS.safetyContext;
  mode: PresentValue<"DEMO">;
  dataset: PresentValue<DashboardDataset>;
  storageMode: PresentValue<"POSTGRESQL" | "MEMORY_DEMO">;
  researchState: PresentValue<"RESEARCH_ONLY">;
  tenantScope: PresentValue<"REQUEST_ACTOR_TENANT">;
  outbound: ReadValue<{
    enabled: false;
    actions: 0;
    sideEffects: 0;
  }>;
}

export interface LaneRunValue {
  runReference: string;
  status: ResearchRunStatus;
  startedAt: string;
  completedAt: string | null;
  stopReason: ReadValue<
    "INPUT_EXHAUSTED" | "DAILY_CAP" | "DIMINISHING_RETURNS" | "TIME_CAP"
  >;
}

export interface LaneSummaryItemV1 {
  laneKey: LaneKey;
  displayName: string;
  researchState: PresentValue<"RESEARCH_ONLY">;
  packState: PresentValue<PackState>;
  latestRun: ReadValue<LaneRunValue>;
}

export interface LaneSummaryReadModelV1 {
  contractVersion: typeof DASHBOARD_SECTION_VERSIONS.laneSummary;
  lanes: LaneSummaryItemV1[];
}

export interface CapLimitsV1 {
  sourceUrls: PresentValue<number>;
  organizations: PresentValue<number>;
  markets: PresentValue<number>;
  drafts: PresentValue<number>;
  elapsedMs: PresentValue<number>;
  consecutiveLowValue: PresentValue<number>;
  paidSpend: PresentValue<0>;
}

export interface CapMeasurementsV1 {
  sourceUrls: ReadValue<number>;
  organizations: ReadValue<number>;
  markets: ReadValue<number>;
  drafts: ReadValue<number>;
  elapsedMs: ReadValue<number>;
  consecutiveLowValue: ReadValue<number>;
  paidSpend: ReadValue<0>;
}

export interface CapUsageItemV1 {
  laneKey: LaneKey;
  scope: "LAST_COMPLETED_RUN";
  sourceRun: ReadValue<{ runReference: string; completedAt: string }>;
  window: ReadValue<{
    startsAt: string;
    endsAt: string;
    timeZone: string;
  }>;
  limits: CapLimitsV1;
  usage: CapMeasurementsV1;
}

export interface CapUsageReadModelV1 {
  contractVersion: typeof DASHBOARD_SECTION_VERSIONS.capUsage;
  lanes: CapUsageItemV1[];
}

export interface MarketRankingItemV1 {
  marketKey: MarketKey;
  displayName: string;
  geographicScope: string;
  representsWholeCountry: boolean;
  rank: ReadValue<number>;
  score: ReadValue<number>;
  confidence: ReadValue<"LOW" | "MEDIUM" | "HIGH">;
}

export interface LaneMarketRankingV1 {
  laneKey: LaneKey;
  sourceRun: ReadValue<{ runReference: string; completedAt: string }>;
  markets: MarketRankingItemV1[];
}

export interface MarketRankingReadModelV1 {
  contractVersion: typeof DASHBOARD_SECTION_VERSIONS.marketRanking;
  lanes: LaneMarketRankingV1[];
}

export type EvidenceMatrixState =
  | "FACT"
  | "INFERENCE"
  | "UNKNOWN"
  | "MISSING";

export interface EvidenceCellV1 {
  category: ComplianceCategory;
  state: EvidenceMatrixState;
  humanSend: "BLOCKED";
  provenance: NonEmptyProvenance;
}

export interface EvidenceMarketRowV1 {
  marketKey: MarketKey;
  displayName: string;
  gateStatus:
    | "HUMAN_SEND_BLOCKED"
    | "HUMAN_REVIEW_REQUIRED"
    | "RECORDED_DECISION_REQUIRED";
  humanSend: "BLOCKED";
  cells: EvidenceCellV1[];
}

export interface EvidenceMatrixReadModelV1 {
  contractVersion: typeof DASHBOARD_SECTION_VERSIONS.evidenceMatrix;
  disclaimer: string;
  precedence: readonly ["UNKNOWN", "FACT", "INFERENCE", "MISSING"];
  markets: EvidenceMarketRowV1[];
}

export interface SafeAuditEntryV2 {
  sequence: number;
  occurredAt: string;
  eventType:
    | "RUN_STARTED"
    | "RUN_RETRIED"
    | "RUN_COMPLETED"
    | "RUN_FAILED"
    | "DRAFT_DECIDED_INTERNAL_ONLY"
    | "TENANT_DOMAIN_SUPPRESSED"
    | "MARKET_SCOUT_ACTIVITY_SNAPSHOT";
  laneKey: LaneKey | null;
  result: "STARTED" | "SUCCEEDED" | "FAILED" | "RECORDED";
  eventReference: string;
  provenance: NonEmptyProvenance;
}

export interface SafeAuditFeedReadModelV2 {
  contractVersion: typeof DASHBOARD_SECTION_VERSIONS.safeAuditFeed;
  access: "DETAIL" | "HEALTH_ONLY";
  integrity: ReadValue<"CONTIGUOUS_SEQUENCE">;
  totalEvents: PresentValue<number>;
  lastSequence: ReadValue<number>;
  entries: SafeAuditEntryV2[];
  nextCursor: string | null;
}

export interface DashboardReadModelV2 {
  contractVersion: typeof DASHBOARD_READ_MODEL_VERSION;
  generatedAt: string;
  missingSemantics: {
    contractVersion: "manovaflow.dashboard.missing.v1";
    zeroFromAbsence: false;
    description: string;
  };
  safetyContext: SafetyContextReadModelV2;
  laneSummary: LaneSummaryReadModelV1;
  capUsage: CapUsageReadModelV1;
  marketRanking: MarketRankingReadModelV1;
  evidenceMatrix: EvidenceMatrixReadModelV1;
  safeAuditFeed: SafeAuditFeedReadModelV2;
}
