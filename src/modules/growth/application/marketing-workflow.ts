import { parseCandidate } from "../domain/candidate-schema";
import { scoreCandidate } from "../domain/scoring";
import type { ActorContext } from "../domain/types";
import { serviceflowManifest } from "../manifests/serviceflow";
import {
  normalizeDomain,
  type CompanyRecord,
  type CompanyScoreRecord,
  type DashboardSnapshot
} from "./repository";
import type { MarketScoutActivitySnapshotV1 } from "./market-scout-activity";
import type { MarketScoutReviewEvidenceState } from "./market-scout-activity-read-model";
import type { MarketScoutReviewEvidenceV1 } from "./market-scout-review-evidence";
import {
  createInternalPitch,
  isPublicWorkflowUrl,
  MARKETING_PIPELINE_VERSION,
  marketingPipelineSchema,
  validateInternalPitch,
  WORKFLOW_HOLDS,
  type MarketingPipeline,
  type MarketingProspect
} from "./marketing-workflow-contract";

type Review = MarketScoutReviewEvidenceV1["reviews"][number];
const readOnlyBudget = Object.freeze({
  paidSpend: 0,
  externalRequests: 0,
  outboundActions: 0
});
const roleOperations: Readonly<Record<string, string>> = Object.freeze({
  PROSPECTOR: "NORMALIZE_RECORDED_DATA",
  QUALIFIER: "QUALIFY_RECORDED_DATA",
  PITCHER: "DRAFT_INTERNAL",
  SUPERVISOR: "VALIDATE_INTERNAL"
});

export function authorizeMarketingAction(
  role: string,
  action: string,
  budget: {
    paidSpend: number;
    externalRequests: number;
    outboundActions: number;
  }
): void {
  if (
    !Object.hasOwn(roleOperations, role) ||
    roleOperations[role] !== action ||
    budget.paidSpend !== 0 ||
    budget.externalRequests !== 0 ||
    budget.outboundActions !== 0
  )
    throw new Error("WORKFLOW_ACTION_DENIED");
}

export function buildMarketingPipeline(
  actor: ActorContext,
  dashboard: DashboardSnapshot,
  activity: MarketScoutActivitySnapshotV1,
  evidence: MarketScoutReviewEvidenceState
): MarketingPipeline {
  // Tenant validation precedes the role projection, including rows not eventually exposed.
  const tenantRows: readonly { tenantId: string }[] =
    Object.values(dashboard).flat();
  if (tenantRows.some((row) => row.tenantId !== actor.tenantId))
    throw new Error("WORKFLOW_TENANT_MISMATCH");
  if (actor.role === "VIEWER")
    return { state: "RESTRICTED", reason: "ROLE_RESTRICTED" };
  if (actor.role !== "OWNER" && actor.role !== "OPERATOR")
    throw new Error("WORKFLOW_ROLE_INVALID");
  if (
    activity.query.laneKey !== "serviceflow" ||
    activity.query.countryCode !== "FR"
  )
    return { state: "UNAVAILABLE", reason: "UNSUPPORTED_SCOPE" };
  if (evidence.state !== "READY")
    return { state: "UNAVAILABLE", reason: "NOT_RECORDED" };
  const runs = dashboard.runs.filter(
    (run) => run.id === activity.runId && run.laneKey === "serviceflow"
  );
  if (
    activity.status !== "COMPLETED" ||
    runs.length === 0 ||
    runs[0]!.status !== "COMPLETED"
  )
    return { state: "UNAVAILABLE", reason: "RUN_NOT_COMPLETE" };
  if (runs.length !== 1 || evidence.bundle.runId !== activity.runId)
    throw new Error("WORKFLOW_RUN_MISMATCH");
  const run = runs[0]!;
  const start = instant(run.startedAt);
  const end = instant(run.completedAt);
  const activityStart = instant(activity.startedAt);
  const activityEnd = instant(activity.finishedAt);
  if (
    activityStart > start ||
    start > end ||
    end > activityEnd ||
    activityEnd > instant(activity.snapshotAt)
  )
    throw new Error("WORKFLOW_CHRONOLOGY_INVALID");

  const prospects = evidence.bundle.reviews.map(
    (review, index): MarketingProspect => {
      authorizeMarketingAction(
        "PROSPECTOR",
        "NORMALIZE_RECORDED_DATA",
        readOnlyBudget
      );
      if (!isPublicWorkflowUrl(review.sourceUrl))
        throw new Error("WORKFLOW_SOURCE_INVALID");
      if (
        instant(review.occurredAt) < activityStart ||
        instant(review.occurredAt) > activityEnd
      )
        throw new Error("WORKFLOW_CHRONOLOGY_INVALID");
      const domain = normalizeDomain(new URL(review.sourceUrl).hostname);
      const companies = dashboard.companies.filter(
        (company) => company.normalizedDomain === domain
      );
      if (companies.length > 1) throw new Error("WORKFLOW_COMPANY_AMBIGUOUS");
      const company = companies[0];
      if (company) validateCompany(company);
      const scores = company
        ? dashboard.companyScores.filter(
            (score) =>
              score.companyId === company.id &&
              score.runId === activity.runId &&
              score.laneKey === "serviceflow"
          )
        : [];
      if (scores.length > 1) throw new Error("WORKFLOW_SCORE_AMBIGUOUS");
      const score = scores[0];
      if (score) {
        validateScore(score);
        if (instant(score.createdAt) < start || instant(score.createdAt) > end)
          throw new Error("WORKFLOW_CHRONOLOGY_INVALID");
      }
      const suppressed = dashboard.suppressions.some(
        (record) => record.normalizedDomain === domain
      );
      authorizeMarketingAction(
        "QUALIFIER",
        "QUALIFY_RECORDED_DATA",
        readOnlyBudget
      );
      const qualifier = qualify(review, score, suppressed);
      if (qualifier.qualified)
        authorizeMarketingAction("PITCHER", "DRAFT_INTERNAL", readOnlyBudget);
      const drafts = qualifier.qualified
        ? (["en", "fr", "ar"] as const).map((locale) =>
            createInternalPitch(
              domain,
              review.sourceUrl,
              review.observedFacts,
              locale
            )
          )
        : [];
      authorizeMarketingAction(
        "SUPERVISOR",
        "VALIDATE_INTERNAL",
        readOnlyBudget
      );
      if (
        !drafts.every((draft) =>
          validateInternalPitch(
            draft,
            domain,
            review.sourceUrl,
            review.observedFacts
          )
        )
      )
        throw new Error("WORKFLOW_PITCH_REJECTED");
      return {
        domain,
        sourceUrl: review.sourceUrl,
        sourceReference: `review:${activity.runId}:${index + 1}`,
        reviewedAt: review.occurredAt,
        prospector: { status: "RECORDED", facts: [...review.observedFacts] },
        qualifier,
        pitcher: {
          status: qualifier.qualified ? "READY_INTERNAL_ONLY" : "BLOCKED",
          drafts
        },
        supervisor: {
          status: qualifier.qualified ? "HELD_FOR_HUMAN_REVIEW" : "BLOCKED",
          reasons: [...WORKFLOW_HOLDS],
          outboundEnabled: false,
          authorizationToken: null
        }
      };
    }
  );
  return marketingPipelineSchema.parse({
    state: "READY",
    contractVersion: MARKETING_PIPELINE_VERSION,
    engine: "DETERMINISTIC_RULES",
    persisted: false,
    runId: activity.runId,
    snapshotAt: activity.snapshotAt,
    reviewedSites: prospects.length,
    qualifiedSites: prospects.filter((prospect) => prospect.qualifier.qualified)
      .length,
    proposalCount: prospects.reduce(
      (sum, prospect) => sum + prospect.pitcher.drafts.length,
      0
    ),
    prospects,
    safety: { paidSpend: 0, outboundActions: 0, externalRequests: 0 }
  });
}

function instant(value: string | null): number {
  const parsed = value === null ? NaN : Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("WORKFLOW_CHRONOLOGY_INVALID");
  return parsed;
}

function validateCompany(company: CompanyRecord): void {
  parseCandidate({
    laneKey: "serviceflow",
    marketKey: "fr-france",
    companyName: company.companyName,
    domain: company.domain,
    country: company.country,
    sourceUrl: company.sourceUrl,
    sourceKind: company.sourceKind,
    synthetic: company.synthetic,
    signalKeys: [],
    marketSignalKeys: [],
    riskFlags: []
  });
  if (
    company.country !== "FR" ||
    company.synthetic ||
    company.sourceKind === "WARM_REFERRAL" ||
    !isPublicWorkflowUrl(company.sourceUrl) ||
    normalizeDomain(company.domain) !== company.normalizedDomain
  )
    throw new Error("WORKFLOW_COMPANY_INVALID");
  if (
    company.sourceKind === "PUBLIC_COMPANY_WEBSITE" &&
    normalizeDomain(new URL(company.sourceUrl).hostname) !==
      company.normalizedDomain
  )
    throw new Error("WORKFLOW_COMPANY_INVALID");
}

function validateScore(score: CompanyScoreRecord): void {
  const manifest = serviceflowManifest.scoring;
  if (
    !Array.isArray(score.explanation) ||
    score.explanation.length !== manifest.signals.length
  )
    throw new Error("WORKFLOW_SCORE_INVALID");
  const keys = new Set<string>();
  for (const item of score.explanation) {
    const signal = manifest.signals.find((signal) => signal.key === item.key);
    if (
      !signal ||
      keys.has(item.key) ||
      typeof item.matched !== "boolean" ||
      item.awarded !== (item.matched ? signal.weight : 0)
    )
      throw new Error("WORKFLOW_SCORE_INVALID");
    keys.add(item.key);
  }
  if (score.status === "KILLED") {
    if (score.total !== 0) throw new Error("WORKFLOW_SCORE_INVALID");
    return;
  }
  const recomputed = scoreCandidate(manifest, {
    signalKeys: score.explanation
      .filter((item) => item.matched)
      .map((item) => item.key),
    riskFlags: []
  });
  if (score.total !== recomputed.total || score.status !== recomputed.status)
    throw new Error("WORKFLOW_SCORE_INVALID");
}

function qualify(
  review: Review,
  score: CompanyScoreRecord | undefined,
  suppressed: boolean
): MarketingProspect["qualifier"] {
  const base = {
    score: score?.total ?? null,
    threshold: serviceflowManifest.scoring.threshold,
    scoreReference: score ? `company-score:${score.id}` : null
  };
  if (suppressed)
    return {
      ...base,
      qualified: false,
      status: "REJECTED",
      reasons: ["SUPPRESSED_DOMAIN"]
    };
  if (review.instructionLikeTextDetected)
    return {
      ...base,
      qualified: false,
      status: "NEEDS_REVIEW",
      reasons: ["UNTRUSTED_INSTRUCTION_DETECTED"]
    };
  if (review.outcome !== "SUCCEEDED")
    return {
      ...base,
      qualified: false,
      status: "NEEDS_REVIEW",
      reasons: ["WEBSITE_REVIEW_NOT_SUCCESSFUL"]
    };
  if (!review.observedFacts.length)
    return {
      ...base,
      qualified: false,
      status: "NEEDS_REVIEW",
      reasons: ["NO_REVIEW_SIGNALS"]
    };
  if (!score)
    return {
      ...base,
      qualified: false,
      status: "NEEDS_REVIEW",
      reasons: ["NOT_SCORED_IN_THIS_RUN"]
    };
  if (score.status !== "ELIGIBLE")
    return {
      ...base,
      qualified: false,
      status: "REJECTED",
      reasons: [
        score.status === "KILLED" ? "RISK_RULE_BLOCKED" : "BELOW_FIT_THRESHOLD"
      ]
    };
  return {
    ...base,
    qualified: true,
    status: "QUALIFIED",
    reasons: ["RECORDED_FIT_THRESHOLD_MET"]
  };
}
