import type {
  DashboardSnapshot,
  CompanyScoreRecord
} from "@/modules/growth/application/repository";
import type { ActorContext } from "@/modules/growth/domain/types";

export const workflowActor: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
};
export const workflowAt = "2026-09-06T02:00:00.000Z";
export const workflowRun = "workflow-fixture-run";

// Public-shaped, completely offline fixtures; none is inserted into the app database.
export function workflowFixture(): DashboardSnapshot {
  const reviews = [
    "qualified-fixture.test",
    "below-fixture.test",
    "unscored-fixture.test"
  ].map((domain) => ({
    sourceUrl: `https://www.${domain}/`,
    occurredAt: workflowAt,
    outcome: "SUCCEEDED",
    observedFacts: ["PUBLIC_SERVICE_DESCRIPTION", "PUBLIC_HOURS"],
    potentialFit: "HUMAN_REVIEW_REQUIRED",
    unknowns: [
      "WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
      "WORKFLOW_PAIN_UNVERIFIED",
      "BUYER_AUTHORITY_UNVERIFIED",
      "CUSTOMER_INTEREST_UNVERIFIED"
    ],
    requestsMade: 2,
    bytesRead: 512,
    instructionLikeTextDetected: false
  }));
  return {
    runs: [
      {
        id: workflowRun,
        tenantId: workflowActor.tenantId,
        laneKey: "serviceflow",
        idempotencyKey: "workflow-fixture-key",
        status: "COMPLETED",
        startedAt: "2026-09-06T01:59:00.000Z",
        completedAt: workflowAt,
        error: null,
        summary: null
      }
    ],
    companies: ["qualified-fixture.test", "below-fixture.test"].map(
      (domain, i) => ({
        id: `workflow-company-${i}`,
        tenantId: workflowActor.tenantId,
        companyName: `Offline fixture ${i} — not a lead`,
        domain,
        normalizedDomain: domain,
        country: "FR",
        sourceUrl: `https://dataset-fixture.test/${i}`,
        sourceKind: "OPEN_DATASET",
        synthetic: false,
        createdAt: workflowAt
      })
    ),
    companyScores: [scoreFixture(0, true), scoreFixture(1, false)],
    marketScores: [],
    complianceDecisions: [],
    drafts: [],
    suppressions: [],
    audit: [
      {
        id: "workflow-audit-1",
        tenantId: workflowActor.tenantId,
        actorId: workflowActor.actorId,
        entityId: workflowRun,
        laneKey: "serviceflow",
        sequence: 1,
        eventType: "MARKET_SCOUT_ACTIVITY_SNAPSHOT",
        createdAt: workflowAt,
        details: {
          hidden: "private-audit-tripwire",
          activity: {
            contractVersion: "manovaflow.market-scout.activity.v1",
            runId: workflowRun,
            agent: "market-scout",
            status: "COMPLETED",
            startedAt: "2026-09-06T01:59:00.000Z",
            finishedAt: workflowAt,
            snapshotAt: workflowAt,
            staleAfterMs: 15000,
            query: {
              origin: "SEARCH",
              countryCode: "FR",
              laneKey: "serviceflow",
              filter: "offline-test-only"
            },
            events: reviews.map((review, index) => ({
              sequence: index + 1,
              occurredAt: workflowAt,
              stage: "WEBSITE_REVIEW",
              sourceUrl: review.sourceUrl,
              outcome: "SUCCEEDED",
              decision: "PUBLIC_FACTS_RECORDED",
              reason: "PUBLIC_PAGE_REVIEWED",
              errorCode: null
            }))
          },
          websiteReviewEvidence: {
            contractVersion:
              "manovaflow.market-scout.website-review-evidence.v1",
            runId: workflowRun,
            reviews,
            safety: {
              paidSpend: 0,
              apolloCredits: 0,
              messagesSent: 0,
              formsSubmitted: 0,
              contactReveals: 0,
              outboundActions: 0
            }
          }
        }
      }
    ]
  };
}

function scoreFixture(index: number, eligible: boolean): CompanyScoreRecord {
  const weights = [25, 15, 10, 15, 15, 10, 10];
  const keys = [
    "non_emergency_maintenance",
    "team_size_visible",
    "service_area_visible",
    "recurring_request_flow",
    "visible_intake_gap",
    "supported_public_language",
    "country_research_ready"
  ];
  const matched = eligible ? [0, 1, 2, 5, 6] : [2, 5, 6];
  return {
    id: `workflow-score-${index}`,
    tenantId: workflowActor.tenantId,
    runId: workflowRun,
    companyId: `workflow-company-${index}`,
    laneKey: "serviceflow",
    total: eligible ? 70 : 30,
    status: eligible ? "ELIGIBLE" : "BELOW_THRESHOLD",
    createdAt: workflowAt,
    explanation: keys.map((key, i) => ({
      key,
      label: "untrusted-label-tripwire",
      matched: matched.includes(i),
      awarded: matched.includes(i) ? weights[i]! : 0
    }))
  };
}
