import {
  evaluateComplianceGate,
  REQUIRED_COMPLIANCE_CATEGORIES,
  type ComplianceCategory,
  type ComplianceEvidence
} from "@/modules/compliance/domain/gate";
import type { ActorContext, LaneKey } from "@/modules/growth/domain/types";
import { LANE_KEYS, MARKET_KEYS } from "@/modules/growth/domain/types";
import { growthManifests } from "@/modules/growth/manifests";
import { marketProfiles } from "@/modules/growth/markets";
import { z } from "zod";
import {
  DASHBOARD_READ_MODEL_VERSION,
  DASHBOARD_SECTION_VERSIONS,
  type CapMeasurementsV1,
  type DashboardDataset,
  type DashboardReadModelV2,
  type EvidenceCellV1,
  type EvidenceMarketRowV1,
  type LaneRunValue,
  type MarketRankingItemV1,
  type MissingReason,
  type MissingValue,
  type NonEmptyProvenance,
  type PresentValue,
  type Provenance,
  type SafeAuditEntryV2,
  type SafeAuditFeedReadModelV2
} from "./dashboard-contracts";
import type { DashboardSnapshot, ResearchRunRecord } from "./repository";

const laneRunSummarySchema = z.object({
  runId: z.string().min(1),
  laneKey: z.enum(LANE_KEYS),
  state: z.literal("RESEARCH_ONLY"),
  marketShortlist: z.array(z.object({ marketKey: z.enum(MARKET_KEYS) })),
  companyShortlist: z.array(z.object({ synthetic: z.boolean() })),
  metrics: z.object({
    sourceUrlsReviewed: z.number().int().nonnegative(),
    organizationsConsidered: z.number().int().nonnegative(),
    eligibleCompanies: z.number().int().nonnegative(),
    deduplicatedCompanies: z.number().int().nonnegative(),
    suppressedCompanies: z.number().int().nonnegative(),
    draftsCreated: z.number().int().nonnegative(),
    paidSpend: z.literal(0),
    stoppedBy: z.enum([
      "INPUT_EXHAUSTED",
      "DAILY_CAP",
      "DIMINISHING_RETURNS",
      "TIME_CAP"
    ])
  }),
  outboundActions: z.literal(0)
});

type ParsedLaneRunSummary = z.infer<typeof laneRunSummarySchema>;

const SAFE_AUDIT_EVENT_TYPES = [
  "RUN_STARTED",
  "RUN_RETRIED",
  "RUN_COMPLETED",
  "RUN_FAILED",
  "DRAFT_DECIDED_INTERNAL_ONLY",
  "TENANT_DOMAIN_SUPPRESSED",
  "MARKET_SCOUT_ACTIVITY_SNAPSHOT"
] as const satisfies readonly SafeAuditEntryV2["eventType"][];

const PUBLIC_SOURCE_KINDS = new Set([
  "OFFICIAL_REGISTRY",
  "PUBLIC_COMPANY_WEBSITE",
  "OFFICIAL_ASSOCIATION",
  "OFFICIAL_PROCUREMENT",
  "OPEN_DATASET"
]);

export interface DashboardReadModelInput {
  actor: ActorContext;
  snapshot: DashboardSnapshot;
  generatedAt: string;
  runtime: {
    mode: "DEMO";
    dataset: DashboardDataset;
    storageMode: "POSTGRESQL" | "MEMORY_DEMO";
    outboundGateway: "DISABLED";
    outboundCredentials: "ABSENT";
  };
  auditPage?: {
    beforeSequence?: number;
    limit?: number;
  };
}

export type DashboardReadModelErrorCode =
  | "DASHBOARD_TENANT_SCOPE_VIOLATION"
  | "DASHBOARD_SYNTHETIC_SCOPE_VIOLATION"
  | "DASHBOARD_PUBLIC_SCOPE_VIOLATION"
  | "DASHBOARD_OUTBOUND_INVARIANT_VIOLATION"
  | "DASHBOARD_RUNTIME_INVARIANT_VIOLATION"
  | "DASHBOARD_SOURCE_INTEGRITY_VIOLATION"
  | "DASHBOARD_AUDIT_INTEGRITY_VIOLATION";

export class DashboardReadModelError extends Error {
  readonly code: DashboardReadModelErrorCode;

  constructor(code: DashboardReadModelErrorCode) {
    super("Dashboard read model is unavailable");
    this.name = "DashboardReadModelError";
    this.code = code;
  }
}

export function buildDashboardReadModel(
  input: DashboardReadModelInput
): DashboardReadModelV2 {
  try {
    validateBoundary(input);
    return buildValidatedDashboardReadModel(input);
  } catch (error) {
    if (error instanceof DashboardReadModelError) throw error;
    throw new DashboardReadModelError("DASHBOARD_SOURCE_INTEGRITY_VIOLATION");
  }
}

function buildValidatedDashboardReadModel(
  input: DashboardReadModelInput
): DashboardReadModelV2 {
  const policy = provenance(
    "INVARIANT",
    "SERVER_POLICY",
    "dashboard-research-v2",
    input.generatedAt
  );

  return {
    contractVersion: DASHBOARD_READ_MODEL_VERSION,
    generatedAt: input.generatedAt,
    missingSemantics: {
      contractVersion: "manovaflow.dashboard.missing.v1",
      zeroFromAbsence: false,
      description:
        "MISSING means the observation is absent, unpersisted, stale, unsafe, or unverifiable; it is never coerced to zero."
    },
    safetyContext: {
      contractVersion: DASHBOARD_SECTION_VERSIONS.safetyContext,
      mode: present("DEMO", [policy]),
      dataset: present(input.runtime.dataset, [policy]),
      storageMode: present(input.runtime.storageMode, [policy]),
      researchState: present("RESEARCH_ONLY", [policy]),
      tenantScope: present("REQUEST_ACTOR_TENANT", [policy]),
      outbound: present({ enabled: false, actions: 0, sideEffects: 0 }, [
        policy
      ])
    },
    laneSummary: {
      contractVersion: DASHBOARD_SECTION_VERSIONS.laneSummary,
      lanes: LANE_KEYS.map((laneKey) => {
        const latestRun = latestRunFor(input.snapshot, laneKey);
        return {
          laneKey,
          displayName: growthManifests[laneKey].displayName,
          researchState: present("RESEARCH_ONLY", [
            manifestProvenance(laneKey)
          ]),
          packState: present(growthManifests[laneKey].packState, [
            manifestProvenance(laneKey)
          ]),
          latestRun: latestRun
            ? present(runValue(latestRun), [runProvenance(latestRun)])
            : missing("NO_RECORDED_RUN", [
                derivedProvenance("research-runs:" + laneKey, input.generatedAt)
              ])
        };
      })
    },
    capUsage: {
      contractVersion: DASHBOARD_SECTION_VERSIONS.capUsage,
      lanes: LANE_KEYS.map((laneKey) => {
        const run = latestCompletedRunFor(input.snapshot, laneKey);
        return {
          laneKey,
          scope: "LAST_COMPLETED_RUN" as const,
          sourceRun: run
            ? present(
                {
                  runReference: runReference(run.id),
                  completedAt: requiredCompletedAt(run)
                },
                [runProvenance(run)]
              )
            : missing("NO_COMPLETED_RUN", [
                derivedProvenance("completed-run:" + laneKey, input.generatedAt)
              ]),
          window: missing("LEDGER_NOT_IMPLEMENTED", [policy]),
          limits: limitsFor(laneKey),
          usage: run
            ? usageFor(input.snapshot, run)
            : missingUsage(laneKey, input.generatedAt)
        };
      })
    },
    marketRanking: {
      contractVersion: DASHBOARD_SECTION_VERSIONS.marketRanking,
      lanes: LANE_KEYS.map((laneKey) => {
        const run = latestCompletedRunFor(input.snapshot, laneKey);
        return {
          laneKey,
          sourceRun: run
            ? present(
                {
                  runReference: runReference(run.id),
                  completedAt: requiredCompletedAt(run)
                },
                [runProvenance(run)]
              )
            : missing("NO_COMPLETED_RUN", [
                derivedProvenance("market-run:" + laneKey, input.generatedAt)
              ]),
          markets: marketRankingFor(
            input.snapshot,
            laneKey,
            run,
            input.generatedAt
          )
        };
      })
    },
    evidenceMatrix: {
      contractVersion: DASHBOARD_SECTION_VERSIONS.evidenceMatrix,
      disclaimer: "این ابزار جایگزین وکیل نیست.",
      precedence: ["UNKNOWN", "FACT", "INFERENCE", "MISSING"],
      markets: MARKET_KEYS.map((marketKey) =>
        evidenceRow(marketKey, input.generatedAt)
      )
    },
    safeAuditFeed: safeAuditFeed(input, policy)
  };
}

function validateBoundary(input: DashboardReadModelInput): void {
  validTimestamp(input.generatedAt);
  if (
    input.runtime.mode !== "DEMO" ||
    !["SYNTHETIC", "PUBLIC_RESEARCH"].includes(input.runtime.dataset) ||
    !["POSTGRESQL", "MEMORY_DEMO"].includes(input.runtime.storageMode) ||
    input.runtime.outboundGateway !== "DISABLED" ||
    input.runtime.outboundCredentials !== "ABSENT"
  ) {
    throw new DashboardReadModelError(
      input.runtime.outboundGateway !== "DISABLED" ||
        input.runtime.outboundCredentials !== "ABSENT"
        ? "DASHBOARD_OUTBOUND_INVARIANT_VIOLATION"
        : "DASHBOARD_RUNTIME_INVARIANT_VIOLATION"
    );
  }

  assertTenantScope(input);
  assertDatasetScope(input.snapshot, input.runtime.dataset);
  assertOutboundInvariant(input.snapshot);
  validateSourceRecords(input.snapshot);
  validateAuditIntegrity(input.snapshot);
  validateAuditPage(input.auditPage);
}

function assertTenantScope(input: DashboardReadModelInput): void {
  const collections: readonly (readonly { tenantId: string }[])[] = [
    input.snapshot.runs,
    input.snapshot.companies,
    input.snapshot.companyScores,
    input.snapshot.marketScores,
    input.snapshot.complianceDecisions,
    input.snapshot.drafts,
    input.snapshot.suppressions,
    input.snapshot.audit
  ];
  if (
    collections.some((records) =>
      records.some((record) => record.tenantId !== input.actor.tenantId)
    )
  ) {
    throw new DashboardReadModelError("DASHBOARD_TENANT_SCOPE_VIOLATION");
  }
}

export function dashboardDatasetFor(
  snapshot: DashboardSnapshot
): DashboardDataset {
  const hasPublicRecords =
    snapshot.companies.some((company) => company.synthetic === false) ||
    snapshot.drafts.some((draft) => draft.synthetic === false) ||
    snapshot.audit.some(
      (event) => event.eventType === "MARKET_SCOUT_ACTIVITY_SNAPSHOT"
    ) ||
    snapshot.runs.some((run) => {
      const shortlist = run.summary?.companyShortlist;
      return (
        Array.isArray(shortlist) &&
        shortlist.some((item) => isRecord(item) && item.synthetic === false)
      );
    });
  return hasPublicRecords ? "PUBLIC_RESEARCH" : "SYNTHETIC";
}

function assertDatasetScope(
  snapshot: DashboardSnapshot,
  dataset: DashboardDataset
): void {
  const synthetic = dataset === "SYNTHETIC";
  const errorCode = synthetic
    ? "DASHBOARD_SYNTHETIC_SCOPE_VIOLATION"
    : "DASHBOARD_PUBLIC_SCOPE_VIOLATION";
  if (
    snapshot.companies.some(
      (company) =>
        company.synthetic !== synthetic ||
        (synthetic
          ? company.sourceKind !== "SYNTHETIC"
          : !PUBLIC_SOURCE_KINDS.has(company.sourceKind) ||
            !safeHttpsUrl(company.sourceUrl))
    ) ||
    snapshot.drafts.some((draft) => draft.synthetic !== synthetic)
  ) {
    throw new DashboardReadModelError(errorCode);
  }

  for (const run of snapshot.runs) {
    if (!isRecord(run.summary)) continue;
    const companies = run.summary.companyShortlist;
    if (
      Array.isArray(companies) &&
      companies.some(
        (company) => isRecord(company) && company.synthetic !== synthetic
      )
    ) {
      throw new DashboardReadModelError(errorCode);
    }
  }
}

function assertOutboundInvariant(snapshot: DashboardSnapshot): void {
  if (
    snapshot.drafts.some((draft) => draft.outboundEnabled !== false) ||
    snapshot.complianceDecisions.some(
      (decision) => decision.authorizationToken !== null
    )
  ) {
    throw new DashboardReadModelError("DASHBOARD_OUTBOUND_INVARIANT_VIOLATION");
  }
  for (const run of snapshot.runs) {
    if (!isRecord(run.summary)) continue;
    const metrics = run.summary.metrics;
    if (
      (Object.hasOwn(run.summary, "outboundActions") &&
        run.summary.outboundActions !== 0) ||
      (isRecord(metrics) &&
        Object.hasOwn(metrics, "paidSpend") &&
        metrics.paidSpend !== 0)
    ) {
      throw new DashboardReadModelError(
        "DASHBOARD_OUTBOUND_INVARIANT_VIOLATION"
      );
    }
  }
}

function validateSourceRecords(snapshot: DashboardSnapshot): void {
  for (const run of snapshot.runs) {
    validTimestamp(run.startedAt);
    if (run.completedAt !== null) validTimestamp(run.completedAt);
    if (run.status === "COMPLETED") {
      requiredCompletedAt(run);
      validateRunSummaryIntegrity(run, parseSummary(run));
    } else if (run.summary !== null) {
      throw new Error("Non-completed dashboard run has a summary");
    }
  }
  validateMarketScores(snapshot);
  for (const score of snapshot.marketScores) validTimestamp(score.createdAt);
  for (const score of snapshot.companyScores) validTimestamp(score.createdAt);
  for (const company of snapshot.companies) validTimestamp(company.createdAt);
  for (const draft of snapshot.drafts) {
    validTimestamp(draft.createdAt);
    if (draft.decidedAt !== null) validTimestamp(draft.decidedAt);
  }
  for (const suppression of snapshot.suppressions) {
    validTimestamp(suppression.createdAt);
  }
  for (const decision of snapshot.complianceDecisions) {
    validTimestamp(decision.recordedAt);
  }
  for (const event of snapshot.audit) validTimestamp(event.createdAt);
}

function validateRunSummaryIntegrity(
  run: ResearchRunRecord,
  summary: ParsedLaneRunSummary
): void {
  const caps = growthManifests[run.laneKey].dailyCaps;
  const marketKeys = summary.marketShortlist.map((item) => item.marketKey);
  if (
    summary.metrics.sourceUrlsReviewed > caps.sourceUrls ||
    summary.metrics.organizationsConsidered > caps.organizations ||
    summary.metrics.draftsCreated > caps.drafts ||
    marketKeys.length > caps.markets ||
    new Set(marketKeys).size !== marketKeys.length
  ) {
    throw new Error("Dashboard run summary violates its manifest caps");
  }
}

function validateMarketScores(snapshot: DashboardSnapshot): void {
  const runs = new Map<string, ResearchRunRecord>();
  for (const run of snapshot.runs) {
    if (runs.has(run.id)) {
      throw new Error("Dashboard snapshot contains duplicate run ids");
    }
    runs.set(run.id, run);
  }

  const uniqueScores = new Set<string>();
  for (const score of snapshot.marketScores) {
    const run = runs.get(score.runId);
    const key = score.runId + ":" + score.laneKey + ":" + score.marketKey;
    if (
      !run ||
      run.laneKey !== score.laneKey ||
      uniqueScores.has(key) ||
      !Number.isInteger(score.total) ||
      score.total < 0 ||
      score.total > 100 ||
      !["LOW", "MEDIUM", "HIGH"].includes(score.confidence)
    ) {
      throw new Error("Dashboard market score relationship is invalid");
    }
    uniqueScores.add(key);
  }

  for (const run of snapshot.runs) {
    if (run.status !== "COMPLETED") continue;
    const summaryMarkets = parseSummary(run)
      .marketShortlist.map((item) => item.marketKey)
      .sort();
    const scoredMarkets = snapshot.marketScores
      .filter((score) => score.runId === run.id)
      .map((score) => score.marketKey)
      .sort();
    if (
      summaryMarkets.length !== scoredMarkets.length ||
      summaryMarkets.some(
        (marketKey, index) => marketKey !== scoredMarkets[index]
      )
    ) {
      throw new Error("Dashboard completed run market scores are incomplete");
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAuditIntegrity(snapshot: DashboardSnapshot): void {
  const ordered = [...snapshot.audit].sort(
    (left, right) => left.sequence - right.sequence
  );
  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];
    if (
      !event ||
      event.sequence !== index + 1 ||
      !isSafeAuditEventType(event.eventType)
    ) {
      throw new DashboardReadModelError("DASHBOARD_AUDIT_INTEGRITY_VIOLATION");
    }
  }
}

function validateAuditPage(page: DashboardReadModelInput["auditPage"]): void {
  if (
    (page?.limit !== undefined &&
      (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 100)) ||
    (page?.beforeSequence !== undefined &&
      (!Number.isInteger(page.beforeSequence) || page.beforeSequence < 1))
  ) {
    throw new DashboardReadModelError("DASHBOARD_AUDIT_INTEGRITY_VIOLATION");
  }
}

function safeAuditFeed(
  input: DashboardReadModelInput,
  policy: Provenance
): SafeAuditFeedReadModelV2 {
  const ordered = [...input.snapshot.audit].sort(
    (left, right) => right.sequence - left.sequence
  );
  const last = ordered[0] ?? null;
  const totalProvenance = derivedProvenance(
    "audit-event-count",
    input.generatedAt
  );
  const base = {
    contractVersion: DASHBOARD_SECTION_VERSIONS.safeAuditFeed,
    integrity: present("CONTIGUOUS_SEQUENCE" as const, [
      last ? auditProvenance(last.sequence, last.createdAt) : policy
    ]),
    totalEvents: present(ordered.length, [totalProvenance]),
    lastSequence: last
      ? present(last.sequence, [auditProvenance(last.sequence, last.createdAt)])
      : missing("NO_AUDIT_EVENTS" as const, [
          derivedProvenance("audit-last-sequence", input.generatedAt)
        ])
  };

  if (input.actor.role === "VIEWER") {
    return {
      ...base,
      access: "HEALTH_ONLY",
      entries: [],
      nextCursor: null
    };
  }

  const before = input.auditPage?.beforeSequence;
  const limit = input.auditPage?.limit ?? 50;
  const eligible =
    before === undefined
      ? ordered
      : ordered.filter((event) => event.sequence < before);
  const page = eligible.slice(0, limit);
  const entries = page.map((event) => safeAuditEntry(event));
  const finalEvent = page.at(-1);
  return {
    ...base,
    access: "DETAIL",
    entries,
    nextCursor:
      eligible.length > page.length && finalEvent
        ? String(finalEvent.sequence)
        : null
  };
}

function safeAuditEntry(
  event: DashboardSnapshot["audit"][number]
): SafeAuditEntryV2 {
  if (!isSafeAuditEventType(event.eventType)) {
    throw new DashboardReadModelError("DASHBOARD_AUDIT_INTEGRITY_VIOLATION");
  }
  return {
    sequence: event.sequence,
    occurredAt: event.createdAt,
    eventType: event.eventType,
    laneKey: event.laneKey,
    result: auditResult(event.eventType),
    eventReference: "audit:" + event.sequence,
    provenance: [auditProvenance(event.sequence, event.createdAt)]
  };
}

function auditResult(
  eventType: SafeAuditEntryV2["eventType"]
): SafeAuditEntryV2["result"] {
  switch (eventType) {
    case "RUN_STARTED":
    case "RUN_RETRIED":
      return "STARTED";
    case "RUN_COMPLETED":
      return "SUCCEEDED";
    case "RUN_FAILED":
      return "FAILED";
    case "DRAFT_DECIDED_INTERNAL_ONLY":
    case "TENANT_DOMAIN_SUPPRESSED":
    case "MARKET_SCOUT_ACTIVITY_SNAPSHOT":
      return "RECORDED";
  }
}

function auditProvenance(sequence: number, recordedAt: string): Provenance {
  return provenance("OBSERVED", "AUDIT_EVENT", "audit:" + sequence, recordedAt);
}

function isSafeAuditEventType(
  value: string
): value is SafeAuditEntryV2["eventType"] {
  return (SAFE_AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}

function evidenceRow(
  marketKey: (typeof MARKET_KEYS)[number],
  generatedAt: string
): EvidenceMarketRowV1 {
  const profile = marketProfiles[marketKey];
  const gate = evaluateComplianceGate(
    {
      marketKey,
      targetStage: "HUMAN_SEND",
      evidence: profile.officialReferences,
      humanLegalReview: false
    },
    new Date(validTimestamp(generatedAt))
  );
  if (gate.status === "RESEARCH_ONLY_ALLOWED") {
    throw new Error("Dashboard evidence gate target stage is invalid");
  }
  return {
    marketKey,
    displayName: profile.displayName,
    gateStatus: gate.status,
    humanSend: "BLOCKED",
    cells: REQUIRED_COMPLIANCE_CATEGORIES.map((category) =>
      evidenceCell(
        marketKey,
        category,
        profile.officialReferences,
        gate.missingCategories,
        generatedAt
      )
    )
  };
}

function evidenceCell(
  marketKey: (typeof MARKET_KEYS)[number],
  category: ComplianceCategory,
  evidence: readonly ComplianceEvidence[],
  missingCategories: readonly ComplianceCategory[],
  generatedAt: string
): EvidenceCellV1 {
  const candidates = evidence.filter((item) => item.category === category);
  const unknowns = candidates.filter(
    (item) => item.classification === "UNKNOWN"
  );
  if (unknowns.length > 0) {
    return classifiedEvidenceCell(category, "UNKNOWN", unknowns, marketKey);
  }

  const facts = candidates.filter((item) => item.classification === "FACT");
  if (facts.length > 0 && !missingCategories.includes(category)) {
    return classifiedEvidenceCell(category, "FACT", facts, marketKey);
  }

  const inferences = candidates.filter(
    (item) =>
      item.classification === "INFERENCE" &&
      isFreshSafeEvidence(item, generatedAt)
  );
  if (inferences.length > 0) {
    return classifiedEvidenceCell(category, "INFERENCE", inferences, marketKey);
  }

  return {
    category,
    state: "MISSING",
    humanSend: "BLOCKED",
    provenance: [
      provenance(
        "DERIVED",
        "MARKET_PROFILE",
        "market-profile:" + marketKey + ":missing:" + category,
        generatedAt
      )
    ]
  };
}

function classifiedEvidenceCell(
  category: ComplianceCategory,
  state: Extract<EvidenceCellV1["state"], "FACT" | "INFERENCE" | "UNKNOWN">,
  evidence: readonly ComplianceEvidence[],
  marketKey: (typeof MARKET_KEYS)[number]
): EvidenceCellV1 {
  const items = evidence.map((item, index) =>
    provenance(
      "OBSERVED",
      "COMPLIANCE_EVIDENCE",
      safeEvidenceReference(item.sourceUrl, marketKey, category, index),
      safeRecordedAt(item.checkedAt)
    )
  );
  const first = items[0];
  if (!first) {
    throw new Error("Classified dashboard evidence requires provenance");
  }
  return {
    category,
    state,
    humanSend: "BLOCKED",
    provenance: [first, ...items.slice(1)]
  };
}

function isFreshSafeEvidence(
  evidence: ComplianceEvidence,
  generatedAt: string
): boolean {
  if (evidence.publisherType !== "OFFICIAL") return false;
  if (!safeHttpsUrl(evidence.sourceUrl)) return false;
  const observed = Date.parse(evidence.checkedAt);
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(observed) || observed > generated) return false;
  return generated - observed <= 90 * 24 * 60 * 60 * 1_000;
}

function safeEvidenceReference(
  sourceUrl: string,
  marketKey: (typeof MARKET_KEYS)[number],
  category: ComplianceCategory,
  index: number
): string {
  const parsed = safeHttpsUrl(sourceUrl);
  if (!parsed) {
    return "market-profile:" + marketKey + ":" + category + ":" + index;
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function safeHttpsUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function safeRecordedAt(value: string): string | null {
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function latestRunFor(
  snapshot: DashboardSnapshot,
  laneKey: LaneKey
): ResearchRunRecord | null {
  return latestByStartedAt(
    snapshot.runs.filter((run) => run.laneKey === laneKey)
  );
}

function latestCompletedRunFor(
  snapshot: DashboardSnapshot,
  laneKey: LaneKey
): ResearchRunRecord | null {
  return latestByStartedAt(
    snapshot.runs.filter(
      (run) => run.laneKey === laneKey && run.status === "COMPLETED"
    )
  );
}

function latestByStartedAt(
  runs: readonly ResearchRunRecord[]
): ResearchRunRecord | null {
  return (
    [...runs].sort(
      (left, right) => timestamp(right.startedAt) - timestamp(left.startedAt)
    )[0] ?? null
  );
}

function runValue(run: ResearchRunRecord): LaneRunValue {
  const summary = run.status === "COMPLETED" ? parseSummary(run) : null;
  return {
    runReference: runReference(run.id),
    status: run.status,
    startedAt: validTimestamp(run.startedAt),
    completedAt:
      run.completedAt === null ? null : validTimestamp(run.completedAt),
    stopReason: summary
      ? present(summary.metrics.stoppedBy, [runProvenance(run)])
      : missing("NOT_PERSISTED", [runProvenance(run)])
  };
}

function usageFor(
  snapshot: DashboardSnapshot,
  run: ResearchRunRecord
): CapMeasurementsV1 {
  const summary = parseSummary(run);
  const source = runProvenance(run);
  const markets = snapshot.marketScores.filter(
    (score) => score.runId === run.id && score.laneKey === run.laneKey
  ).length;
  return {
    sourceUrls: present(summary.metrics.sourceUrlsReviewed, [source]),
    organizations: present(summary.metrics.organizationsConsidered, [source]),
    markets: present(markets, [source]),
    drafts: present(summary.metrics.draftsCreated, [source]),
    elapsedMs: missing("NOT_PERSISTED", [source]),
    consecutiveLowValue: missing("NOT_PERSISTED", [source]),
    paidSpend: present(summary.metrics.paidSpend, [source])
  };
}

function marketRankingFor(
  snapshot: DashboardSnapshot,
  laneKey: LaneKey,
  run: ResearchRunRecord | null,
  generatedAt: string
): MarketRankingItemV1[] {
  if (!run) {
    return MARKET_KEYS.map((marketKey) =>
      missingMarketItem(laneKey, marketKey, "NO_COMPLETED_RUN", generatedAt)
    );
  }

  parseSummary(run);
  const scores = snapshot.marketScores
    .filter((score) => score.runId === run.id && score.laneKey === laneKey)
    .sort(
      (left, right) =>
        right.total - left.total ||
        left.marketKey.localeCompare(right.marketKey)
    );
  const ranks = new Map<(typeof MARKET_KEYS)[number], number>();
  let previousScore: number | null = null;
  let currentRank = 0;
  scores.forEach((score, index) => {
    if (previousScore === null || score.total !== previousScore) {
      currentRank = index + 1;
      previousScore = score.total;
    }
    ranks.set(score.marketKey, currentRank);
  });

  return MARKET_KEYS.map((marketKey) => {
    const score = scores.find((item) => item.marketKey === marketKey);
    if (!score) {
      return missingMarketItem(
        laneKey,
        marketKey,
        "NO_MARKET_SCORE",
        generatedAt
      );
    }
    const source = provenance(
      "OBSERVED",
      "MARKET_SCORE",
      "market-score:" + run.id + ":" + marketKey,
      validTimestamp(score.createdAt)
    );
    return {
      marketKey,
      displayName: marketProfiles[marketKey].displayName,
      geographicScope: geographicScope(marketKey),
      representsWholeCountry:
        marketProfiles[marketKey].geography.representsWholeCountry,
      rank: present(requiredRank(ranks, marketKey), [source]),
      score: present(score.total, [source]),
      confidence: present(score.confidence, [source])
    };
  });
}

function requiredRank(
  ranks: ReadonlyMap<(typeof MARKET_KEYS)[number], number>,
  marketKey: (typeof MARKET_KEYS)[number]
): number {
  const rank = ranks.get(marketKey);
  if (rank === undefined) {
    throw new Error("Dashboard market score is missing a computed rank");
  }
  return rank;
}

function missingMarketItem(
  laneKey: LaneKey,
  marketKey: (typeof MARKET_KEYS)[number],
  reason: Extract<MissingReason, "NO_COMPLETED_RUN" | "NO_MARKET_SCORE">,
  generatedAt: string
): MarketRankingItemV1 {
  const source = derivedProvenance(
    "market-ranking:" + laneKey + ":" + marketKey,
    generatedAt
  );
  return {
    marketKey,
    displayName: marketProfiles[marketKey].displayName,
    geographicScope: geographicScope(marketKey),
    representsWholeCountry:
      marketProfiles[marketKey].geography.representsWholeCountry,
    rank: missing(reason, [source]),
    score: missing(reason, [source]),
    confidence: missing(reason, [source])
  };
}

function parseSummary(run: ResearchRunRecord): ParsedLaneRunSummary {
  const summary = laneRunSummarySchema.parse(run.summary);
  if (summary.runId !== run.id || summary.laneKey !== run.laneKey) {
    throw new Error("Dashboard run summary does not match its run record");
  }
  return summary;
}

function requiredCompletedAt(run: ResearchRunRecord): string {
  if (run.completedAt === null) {
    throw new Error("Completed dashboard run is missing completedAt");
  }
  return validTimestamp(run.completedAt);
}

function runReference(runId: string): string {
  return "run:" + runId;
}

function runProvenance(run: ResearchRunRecord): Provenance {
  return provenance(
    "OBSERVED",
    "RESEARCH_RUN",
    runReference(run.id),
    run.completedAt ?? run.startedAt
  );
}

function validTimestamp(value: string): string {
  timestamp(value);
  return value;
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Dashboard source timestamp is invalid");
  }
  return parsed;
}

function limitsFor(laneKey: LaneKey) {
  const caps = growthManifests[laneKey].dailyCaps;
  const source = manifestProvenance(laneKey);
  return {
    sourceUrls: present(caps.sourceUrls, [source]),
    organizations: present(caps.organizations, [source]),
    markets: present(caps.markets, [source]),
    drafts: present(caps.drafts, [source]),
    elapsedMs: present(caps.elapsedMs, [source]),
    consecutiveLowValue: present(caps.consecutiveLowValue, [source]),
    paidSpend: present(caps.paidSpend, [source])
  };
}

function missingUsage(
  laneKey: LaneKey,
  generatedAt: string
): CapMeasurementsV1 {
  const source = derivedProvenance("cap-usage:" + laneKey, generatedAt);
  return {
    sourceUrls: missing("NO_COMPLETED_RUN", [source]),
    organizations: missing("NO_COMPLETED_RUN", [source]),
    markets: missing("NO_COMPLETED_RUN", [source]),
    drafts: missing("NO_COMPLETED_RUN", [source]),
    elapsedMs: missing("NOT_PERSISTED", [source]),
    consecutiveLowValue: missing("NOT_PERSISTED", [source]),
    paidSpend: missing("NO_COMPLETED_RUN", [source])
  };
}

function geographicScope(marketKey: (typeof MARKET_KEYS)[number]): string {
  const geography = marketProfiles[marketKey].geography;
  return [geography.city, geography.region, geography.countryCode]
    .filter((part): part is string => Boolean(part))
    .join(" / ");
}

function manifestProvenance(laneKey: LaneKey): Provenance {
  return provenance("CONFIG", "VERTICAL_MANIFEST", "manifest:" + laneKey, null);
}

function derivedProvenance(reference: string, recordedAt: string): Provenance {
  return provenance("DERIVED", "SERVER_POLICY", reference, recordedAt);
}

function provenance(
  basis: Provenance["basis"],
  source: Provenance["source"],
  reference: string,
  recordedAt: string | null
): Provenance {
  return { basis, source, reference, recordedAt };
}

function present<T>(
  value: T,
  provenanceItems: NonEmptyProvenance
): PresentValue<T> {
  return { state: "PRESENT", value, provenance: provenanceItems };
}

function missing(
  reason: MissingReason,
  provenanceItems: NonEmptyProvenance
): MissingValue {
  return { state: "MISSING", reason, provenance: provenanceItems };
}
