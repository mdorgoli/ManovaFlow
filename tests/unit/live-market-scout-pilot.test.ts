import { describe, expect, it } from "vitest";
import { runLiveMarketScoutPilot } from "@/modules/growth/application/live-market-scout-pilot";
import type { MarketScoutSource } from "@/modules/growth/application/market-scout-contracts";
import type { MarketScoutWebsiteReviewer } from "@/modules/growth/application/market-scout-website-review";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

const actor = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
} as const;

describe("live Market Scout pilot", () => {
  it("keeps a scoped discovery tenant-isolated and produces three unsent proposal languages", async () => {
    const repository = new InMemoryGrowthRepository();
    const source: MarketScoutSource = {
      async discover(request) {
        expect(request.task).toEqual({
          laneKey: "beautyflow",
          marketKey: "fr-france"
        });
        expect(request.budget).toEqual({
          maxSourceUrls: 1,
          maxOrganizations: 3,
          maxElapsedMs: 5_000
        });
        return {
          sourceUrlsReviewed: 1,
          paidSpend: 0,
          candidates: [{
            candidate: {
              laneKey: "beautyflow",
              marketKey: "fr-france",
              companyName: "Public Hair Studio",
              domain: "public-hair-studio.fr",
              country: "FR",
              sourceUrl: "https://www.openstreetmap.org/node/123",
              reportedPublicWebsiteUrl: "https://public-hair-studio.fr",
              sourceKind: "OPEN_DATASET",
              synthetic: false,
              signalKeys: [
                "non_medical_beauty",
                "catalog_hours_visible",
                "supported_public_language",
                "country_research_ready"
              ],
              marketSignalKeys: [],
              riskFlags: []
            },
            publicText: "Public Hair Studio hairdresser"
          }]
        };
      }
    };
    const websiteReviewer: MarketScoutWebsiteReviewer = {
      async review(request) {
        expect(request.sourceUrl).toBe("https://public-hair-studio.fr");
        expect(request.budget).toEqual({
          maxRequests: 4,
          maxElapsedMs: 8_000,
          maxResponseBytes: 256_000
        });
        return {
          sourceUrl: request.sourceUrl,
          finalUrl: request.sourceUrl,
          outcome: "SUCCEEDED",
          reason: "PUBLIC_PAGE_REVIEWED",
          errorCode: null,
          requestsMade: 2,
          bytesRead: 512,
          contentHandling: "UNTRUSTED_DATA_ONLY",
          untrustedInstructionTextDetected: false,
          documentedFacts: ["PUBLIC_SERVICE_DESCRIPTION", "PUBLIC_BOOKING_PATH"],
          potentialFitReason: "Two public facts may justify later human review; interest is unverified.",
          unknowns: ["CUSTOMER_INTEREST_UNVERIFIED"]
        };
      }
    };

    const result = await runLiveMarketScoutPilot({
      actor,
      batchKey: "live-beauty-fr-1",
      countryCode: "FR",
      laneKey: "beautyflow",
      source,
      websiteReviewer,
      repository,
      now: sequenceClock([
        "2026-09-05T10:00:00.000Z",
        "2026-09-05T10:00:01.000Z",
        "2026-09-05T10:00:02.000Z",
        "2026-09-05T10:00:03.000Z"
      ])
    });

    expect(result).toMatchObject({
      mode: "LIVE_OPEN_DATA_RESEARCH_ONLY",
      scope: { countryCode: "FR", laneKey: "beautyflow" },
      sourceStatus: "SUCCEEDED",
      workerErrors: [],
      humanSend: "BLOCKED",
      costs: { paidSpend: 0, apolloCredits: 0 },
      actions: {
        messagesSent: 0,
        formsSubmitted: 0,
        contactReveals: 0,
        outboundActions: 0
      },
      metrics: {
        sourceAttempts: 1,
        sourceResponsesAccepted: 1,
        organizationsReturned: 1,
        acceptedCandidates: 1
      },
      websiteReviewMetrics: {
        attempts: 1,
        requestsMade: 2,
        successfullyReviewed: 1,
        failed: 0,
        skippedOrRejected: 0,
        bytesRead: 512
      }
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      companyName: "Public Hair Studio",
      fitScore: 60,
      discoveryScoreStatus: "THRESHOLD_MET_NOT_QUALIFIED",
      sourceUrl: "https://www.openstreetmap.org/node/123",
      reportedPublicWebsiteUrl: "https://public-hair-studio.fr",
      productState: "RESEARCH_CONCEPT_NOT_READY"
    });
    expect(result.candidates[0]?.websiteReview).toMatchObject({
      outcome: "SUCCEEDED",
      documentedFacts: ["PUBLIC_SERVICE_DESCRIPTION", "PUBLIC_BOOKING_PATH"]
    });
    expect(result.activity).toMatchObject({
      contractVersion: "manovaflow.market-scout.activity.v1",
      agent: "market-scout",
      status: "COMPLETED",
      query: {
        origin: "SEARCH",
        countryCode: "FR",
        laneKey: "beautyflow"
      }
    });
    expect(result.activity.events.map((event) => event.stage)).toEqual([
      "DISCOVERY",
      "WEBSITE_REVIEW"
    ]);
    expect(result.activity.events.map((event) => event.occurredAt)).toEqual([
      "2026-09-05T10:00:01.000Z",
      "2026-09-05T10:00:02.000Z"
    ]);
    expect(result.activity.snapshotAt).toBe("2026-09-05T10:00:03.000Z");
    expect(Object.keys(result.candidates[0]?.internalDrafts ?? {})).toEqual([
      "en",
      "fr",
      "ar"
    ]);
    expect(JSON.stringify(result.candidates[0]?.internalDrafts)).toContain(
      "NOT SENT"
    );
    expect(JSON.stringify(result.candidates[0]?.internalDrafts)).toContain(
      "NON ENVOYÉ"
    );
    expect(JSON.stringify(result.candidates[0]?.internalDrafts)).toContain(
      "لم يتم الإرسال"
    );
    expect(JSON.stringify(result)).not.toContain("customer is interested");

    const tenantSnapshot = await repository.getDashboard(actor);
    expect(tenantSnapshot.companies).toHaveLength(1);
    const activityAudit = tenantSnapshot.audit.at(-1);
    expect(activityAudit).toMatchObject({
      eventType: "MARKET_SCOUT_ACTIVITY_SNAPSHOT",
      tenantId: actor.tenantId,
      details: {
        activity: {
          contractVersion: "manovaflow.market-scout.activity.v1"
        },
        websiteReviewEvidence: {
          contractVersion: "manovaflow.market-scout.website-review-evidence.v1",
          runId: result.activity.runId,
          reviews: [{
            sourceUrl: "https://public-hair-studio.fr",
            occurredAt: "2026-09-05T10:00:02.000Z",
            outcome: "SUCCEEDED",
            observedFacts: [
              "PUBLIC_SERVICE_DESCRIPTION",
              "PUBLIC_BOOKING_PATH"
            ],
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
        }
      }
    });
    expect(JSON.stringify(activityAudit?.details)).not.toContain(
      "Two public facts may justify later human review"
    );
    const otherTenantSnapshot = await repository.getDashboard({
      ...actor,
      tenantId: "10000000-0000-4000-8000-000000000002"
    });
    expect(otherTenantSnapshot.companies).toHaveLength(0);
  });

  it("surfaces a fail-closed worker error instead of reporting an empty successful discovery", async () => {
    const source: MarketScoutSource = {
      async discover() {
        throw new Error("upstream unavailable");
      }
    };
    const result = await runLiveMarketScoutPilot({
      actor,
      batchKey: "failed-source",
      countryCode: "FR",
      laneKey: "serviceflow",
      source,
      repository: new InMemoryGrowthRepository()
    });

    expect(result.sourceStatus).toBe("FAILED");
    expect(result.workerErrors).toEqual(["MARKET_SCOUT_SOURCE_FAILED"]);
    expect(result.candidates).toEqual([]);
    expect(result.actions.outboundActions).toBe(0);
    expect(result.activity.status).toBe("FAILED");
    expect(result.activity.events).toHaveLength(1);
  });

  it("rejects unsupported country input before calling the source", async () => {
    let called = false;
    const source: MarketScoutSource = {
      async discover() {
        called = true;
        return {};
      }
    };
    await expect(runLiveMarketScoutPilot({
      actor,
      batchKey: "unsupported-country",
      countryCode: "US",
      laneKey: "serviceflow",
      source,
      repository: new InMemoryGrowthRepository()
    })).rejects.toThrow("MARKET_SCOUT_COUNTRY_NOT_CONFIGURED");
    expect(called).toBe(false);
  });
});

function sequenceClock(values: readonly string[]): () => Date {
  let index = 0;
  return () => {
    const value = values[index];
    if (!value) throw new Error("Test clock exhausted");
    index += 1;
    return new Date(value);
  };
}
