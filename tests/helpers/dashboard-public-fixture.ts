import type { ActorContext } from "@/modules/growth/domain/types";
import type { DashboardSnapshot } from "@/modules/growth/application/repository";

export const dashboardActor: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
};
export const dashboardRecordedAt = "2026-09-06T00:15:00.000Z";

// Offline fixture only: no public endpoint is contacted by these tests.
export function publicDashboardSnapshot(): DashboardSnapshot {
  const runId = "30000000-0000-4000-8000-000000000001";
  return {
    runs: [
      {
        id: runId,
        tenantId: dashboardActor.tenantId,
        laneKey: "serviceflow",
        idempotencyKey: "offline-dashboard-acceptance",
        status: "COMPLETED",
        startedAt: "2026-09-06T00:14:00.000Z",
        completedAt: dashboardRecordedAt,
        error: null,
        summary: {
          runId,
          laneKey: "serviceflow",
          state: "RESEARCH_ONLY",
          marketShortlist: [],
          companyShortlist: [],
          metrics: {
            sourceUrlsReviewed: 2,
            organizationsConsidered: 2,
            eligibleCompanies: 0,
            deduplicatedCompanies: 0,
            suppressedCompanies: 0,
            draftsCreated: 0,
            paidSpend: 0,
            stoppedBy: "DIMINISHING_RETURNS"
          },
          outboundActions: 0
        }
      }
    ],
    companies: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        tenantId: dashboardActor.tenantId,
        companyName: "private-company-tripwire",
        domain: "research-fixture.test",
        normalizedDomain: "research-fixture.test",
        country: "FR",
        sourceUrl: "https://research-fixture.test/dataset",
        sourceKind: "OPEN_DATASET",
        synthetic: false,
        createdAt: dashboardRecordedAt
      }
    ],
    companyScores: [],
    marketScores: [],
    complianceDecisions: [],
    drafts: [],
    suppressions: [],
    audit: [
      "RUN_STARTED",
      "RUN_COMPLETED",
      "MARKET_SCOUT_ACTIVITY_SNAPSHOT"
    ].map((eventType, index) => ({
      id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      tenantId: dashboardActor.tenantId,
      sequence: index + 1,
      eventType,
      laneKey: "serviceflow",
      entityId: runId,
      actorId: dashboardActor.actorId,
      details: {
        raw: "private-audit-tripwire",
        authorization: "never-expose-token"
      },
      createdAt: dashboardRecordedAt
    }))
  };
}
