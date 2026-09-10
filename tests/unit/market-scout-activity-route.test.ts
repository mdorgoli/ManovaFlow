import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSnapshot } from "@/modules/growth/application/repository";
import type { ActorContext } from "@/modules/growth/domain/types";

const state = vi.hoisted(() => ({
  snapshot: null as unknown as DashboardSnapshot,
  dashboardReads: 0,
  actor: {
    tenantId: "10000000-0000-4000-8000-000000000001",
    actorId: "20000000-0000-4000-8000-000000000001",
    role: "VIEWER"
  } as ActorContext
}));

vi.mock("@/lib/container", () => ({
  getGrowthRepository: () => ({
    getDashboard: async () => {
      state.dashboardReads += 1;
      return structuredClone(state.snapshot);
    }
  })
}));

vi.mock("@/lib/request-auth", () => ({
  resolveRequestActor: async () => structuredClone(state.actor)
}));

import { GET } from "@/app/api/market-scout/activity/route";

beforeEach(() => {
  state.snapshot = emptySnapshot();
  state.dashboardReads = 0;
  vi.stubGlobal("fetch", vi.fn());
});

describe("GET /api/market-scout/activity", () => {
  it("returns EMPTY privately without starting any external request", async () => {
    const response = await GET(
      new Request("https://app.example.test/api/market-scout/activity")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      contractVersion: "manovaflow.market-scout.activity-feed.v3",
      state: "EMPTY",
      snapshot: null,
      websiteReviewEvidence: null,
      marketingPipeline: null
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a generic 503 without leaking a cross-tenant row", async () => {
    state.snapshot.audit.push({
      id: "60000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000002",
      sequence: 1,
      eventType: "MARKET_SCOUT_ACTIVITY_SNAPSHOT",
      laneKey: "serviceflow",
      entityId: "secret-run",
      actorId: "20000000-0000-4000-8000-000000000002",
      details: { secret: "do-not-leak" },
      createdAt: "2026-09-05T10:00:00.000Z"
    });

    const response = await GET(
      new Request("https://app.example.test/api/market-scout/activity")
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: "MARKET_SCOUT_ACTIVITY_UNAVAILABLE",
        message: "Market Scout activity is unavailable"
      }
    });
    expect(JSON.stringify(body)).not.toContain("do-not-leak");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects client-controlled tenant identity before reading activity", async () => {
    const response = await GET(
      new Request("https://app.example.test/api/market-scout/activity", {
        headers: { "x-tenant-id": "client-controlled" }
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.dashboardReads).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});

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
