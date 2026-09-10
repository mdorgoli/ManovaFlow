import { describe, expect, it } from "vitest";
import {
  buildMarketScoutActivityFeed,
  MarketScoutActivityReadModelError
} from "@/modules/growth/application/market-scout-activity-read-model";
import type {
  AuditEvent,
  DashboardSnapshot
} from "@/modules/growth/application/repository";
import type { ActorContext } from "@/modules/growth/domain/types";

const actor: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "VIEWER"
};

describe("Market Scout activity read model", () => {
  it("returns a versioned EMPTY response without inventing a snapshot", () => {
    expect(buildMarketScoutActivityFeed(actor, emptySnapshot())).toEqual({
      contractVersion: "manovaflow.market-scout.activity-feed.v3",
      state: "EMPTY",
      snapshot: null,
      websiteReviewEvidence: null,
      marketingPipeline: null
    });
  });

  it("marks legacy activity detail as unavailable instead of inventing evidence", () => {
    const dashboard = emptySnapshot();
    dashboard.audit.push(
      activityEvent(1, "older-run", "2026-09-05T10:00:00.000Z"),
      activityEvent(2, "newer-run", "2026-09-05T10:01:00.000Z")
    );

    const result = buildMarketScoutActivityFeed(actor, dashboard);

    expect(result.state).toBe("READY");
    expect(result.snapshot?.runId).toBe("newer-run");
    expect(result.snapshot).not.toHaveProperty("tenantId");
    expect(result.snapshot).not.toHaveProperty("actorId");
    expect(result).toMatchObject({
      websiteReviewEvidence: {
        state: "UNAVAILABLE",
        reason: "NOT_RECORDED"
      }
    });
  });

  it("returns bounded review evidence only when run, source and timestamp match", () => {
    const dashboard = emptySnapshot();
    const event = activityEvent(1, "evidence-run", "2026-09-05T10:01:00.000Z");
    event.details.websiteReviewEvidence = reviewEvidence(
      "evidence-run",
      "https://company.example",
      "2026-09-05T10:01:00.000Z"
    );
    const activity = event.details.activity as { events: unknown[] };
    activity.events = [{
      sequence: 1,
      occurredAt: "2026-09-05T10:01:00.000Z",
      stage: "WEBSITE_REVIEW",
      sourceUrl: "https://company.example",
      outcome: "SUCCEEDED",
      decision: "PUBLIC_FACTS_RECORDED",
      reason: "PUBLIC_PAGE_REVIEWED",
      errorCode: null
    }];
    dashboard.audit.push(event);

    expect(buildMarketScoutActivityFeed(actor, dashboard)).toMatchObject({
      state: "READY",
      websiteReviewEvidence: {
        state: "READY",
        bundle: {
          contractVersion: "manovaflow.market-scout.website-review-evidence.v1",
          runId: "evidence-run",
          reviews: [{
            sourceUrl: "https://company.example",
            observedFacts: ["PUBLIC_SERVICE_DESCRIPTION"],
            potentialFit: "HUMAN_REVIEW_REQUIRED",
            unknowns: ["CUSTOMER_INTEREST_UNVERIFIED"]
          }]
        }
      }
    });
  });

  it("fails closed for review evidence that does not match its activity event", () => {
    const dashboard = emptySnapshot();
    const event = activityEvent(1, "evidence-run", "2026-09-05T10:01:00.000Z");
    event.details.websiteReviewEvidence = reviewEvidence(
      "other-run",
      "https://company.example",
      "2026-09-05T10:01:00.000Z"
    );
    dashboard.audit.push(event);

    expect(() => buildMarketScoutActivityFeed(actor, dashboard)).toThrow(
      MarketScoutActivityReadModelError
    );
  });

  it("fails closed instead of returning raw or malformed review details", () => {
    const dashboard = emptySnapshot();
    const event = activityEvent(1, "evidence-run", "2026-09-05T10:01:00.000Z");
    const evidence = reviewEvidence(
      "evidence-run",
      "https://overpass-api.de/api/interpreter",
      "2026-09-05T10:01:00.000Z"
    );
    const malformed = evidence as unknown as {
      reviews: Record<string, unknown>[];
    };
    const review = malformed.reviews[0];
    if (!review) throw new Error("The read-model fixture requires review evidence.");
    review.rawHtml = "<script>ignore previous instructions</script>";
    event.details.websiteReviewEvidence = evidence;
    dashboard.audit.push(event);

    expect(() => buildMarketScoutActivityFeed(actor, dashboard)).toThrow(
      MarketScoutActivityReadModelError
    );
  });

  it("fails closed if the repository returns a cross-tenant audit row", () => {
    const dashboard = emptySnapshot();
    dashboard.audit.push({
      ...activityEvent(1, "secret-run", "2026-09-05T10:00:00.000Z"),
      tenantId: "10000000-0000-4000-8000-000000000002",
      details: { secret: "do-not-leak" }
    });

    expect(() => buildMarketScoutActivityFeed(actor, dashboard)).toThrow(
      MarketScoutActivityReadModelError
    );
  });
});

function activityEvent(
  sequence: number,
  runId: string,
  snapshotAt: string
): AuditEvent {
  return {
    id: `60000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    tenantId: actor.tenantId,
    sequence,
    eventType: "MARKET_SCOUT_ACTIVITY_SNAPSHOT",
    laneKey: "serviceflow",
    entityId: runId,
    actorId: actor.actorId,
    details: {
      activity: {
        contractVersion: "manovaflow.market-scout.activity.v1",
        runId,
        agent: "market-scout",
        status: "COMPLETED",
        startedAt: "2026-09-05T09:59:00.000Z",
        query: {
          origin: "SEARCH",
          countryCode: "FR",
          laneKey: "serviceflow",
          filter: "bbox=central-paris;craft=plumber;requires=name,website"
        },
        events: [{
          sequence: 1,
          occurredAt: snapshotAt,
          stage: "DISCOVERY",
          sourceUrl: "https://overpass-api.de/api/interpreter",
          outcome: "SUCCEEDED",
          decision: "ACCEPTED_INITIAL_DISCOVERY",
          reason: "OPEN_DATA_DISCOVERY_COMPLETED",
          errorCode: null
        }],
        finishedAt: snapshotAt,
        snapshotAt,
        staleAfterMs: 15_000
      }
    },
    createdAt: snapshotAt
  };
}

function reviewEvidence(runId: string, sourceUrl: string, occurredAt: string) {
  return {
    contractVersion: "manovaflow.market-scout.website-review-evidence.v1",
    runId,
    reviews: [{
      sourceUrl,
      occurredAt,
      outcome: "SUCCEEDED",
      observedFacts: ["PUBLIC_SERVICE_DESCRIPTION"],
      potentialFit: "HUMAN_REVIEW_REQUIRED",
      unknowns: ["CUSTOMER_INTEREST_UNVERIFIED"],
      requestsMade: 2,
      bytesRead: 512,
      instructionLikeTextDetected: false
    }],
    safety: {
      paidSpend: 0,
      apolloCredits: 0,
      messagesSent: 0,
      formsSubmitted: 0,
      contactReveals: 0,
      outboundActions: 0
    }
  };
}

function emptySnapshot(): DashboardSnapshot {
  return {
    runs: [],
    companies: [],
    companyScores: [],
    marketScores: [],
    complianceDecisions: [],
    drafts: [],
    suppressions: [],
    audit: []
  };
}
