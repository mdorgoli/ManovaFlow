import { describe, expect, it } from "vitest";
import { createMarketScoutActivity } from "@/modules/growth/application/market-scout-activity";

describe("Market Scout activity contract", () => {
  it("orders real events and derives a completed-with-errors terminal status", () => {
    const activity = createMarketScoutActivity({
      runId: "run-1",
      status: "COMPLETED",
      startedAt: "2026-09-05T10:00:00.000Z",
      finishedAt: "2026-09-05T10:00:02.000Z",
      snapshotAt: "2026-09-05T10:00:02.000Z",
      query: {
        origin: "SEARCH",
        countryCode: "FR",
        laneKey: "serviceflow",
        filter:
          "bbox=central-paris;craft=plumber|electrician;requires=name,website"
      },
      events: [
        {
          occurredAt: "2026-09-05T10:00:01.000Z",
          stage: "DISCOVERY",
          sourceUrl: "https://overpass-api.de/api/interpreter",
          outcome: "SUCCEEDED",
          decision: "ACCEPTED_INITIAL_DISCOVERY",
          reason: "OPEN_DATA_DISCOVERY_COMPLETED",
          errorCode: null
        },
        {
          occurredAt: "2026-09-05T10:00:02.000Z",
          stage: "WEBSITE_REVIEW",
          sourceUrl: "https://company.example",
          outcome: "FAILED",
          decision: "NO_FACTS_RECORDED",
          reason: "WEBSITE_TIMEOUT",
          errorCode: "WEBSITE_REVIEW_TIME_BUDGET_EXCEEDED"
        }
      ]
    });

    expect(activity).toEqual({
      contractVersion: "manovaflow.market-scout.activity.v1",
      runId: "run-1",
      agent: "market-scout",
      status: "COMPLETED",
      startedAt: "2026-09-05T10:00:00.000Z",
      query: {
        origin: "SEARCH",
        countryCode: "FR",
        laneKey: "serviceflow",
        filter:
          "bbox=central-paris;craft=plumber|electrician;requires=name,website"
      },
      events: [
        {
          sequence: 1,
          occurredAt: "2026-09-05T10:00:01.000Z",
          stage: "DISCOVERY",
          sourceUrl: "https://overpass-api.de/api/interpreter",
          outcome: "SUCCEEDED",
          decision: "ACCEPTED_INITIAL_DISCOVERY",
          reason: "OPEN_DATA_DISCOVERY_COMPLETED",
          errorCode: null
        },
        {
          sequence: 2,
          occurredAt: "2026-09-05T10:00:02.000Z",
          stage: "WEBSITE_REVIEW",
          sourceUrl: "https://company.example",
          outcome: "FAILED",
          decision: "NO_FACTS_RECORDED",
          reason: "WEBSITE_TIMEOUT",
          errorCode: "WEBSITE_REVIEW_TIME_BUDGET_EXCEEDED"
        }
      ],
      finishedAt: "2026-09-05T10:00:02.000Z",
      snapshotAt: "2026-09-05T10:00:02.000Z",
      staleAfterMs: 15_000
    });
  });
});
