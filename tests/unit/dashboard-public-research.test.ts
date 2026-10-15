import { describe, expect, it } from "vitest";
import { buildDashboardReadModel } from "@/modules/growth/application/dashboard-read-model";
import {
  dashboardActor,
  dashboardRecordedAt,
  publicDashboardSnapshot
} from "../helpers/dashboard-public-fixture";

function read(
  snapshot = publicDashboardSnapshot(),
  role = dashboardActor.role
) {
  return buildDashboardReadModel({
    actor: { ...dashboardActor, role },
    snapshot,
    generatedAt: dashboardRecordedAt,
    runtime: {
      mode: "DEMO",
      dataset: "PUBLIC_RESEARCH",
      storageMode: "POSTGRESQL",
      outboundGateway: "DISABLED",
      outboundCredentials: "ABSENT"
    }
  });
}

describe("Public research dashboard boundary", () => {
  it("projects recorded public research without mislabeling it synthetic or exposing raw companies", () => {
    const snapshot = publicDashboardSnapshot();
    const before = JSON.stringify(snapshot);
    const result = read(snapshot);
    expect(result.contractVersion).toBe("manovaflow.dashboard.v2");
    expect(result.safetyContext.dataset.value).toBe("PUBLIC_RESEARCH");
    expect(result.safetyContext.outbound).toMatchObject({
      state: "PRESENT",
      value: { enabled: false, actions: 0, sideEffects: 0 }
    });
    expect(result.capUsage.lanes[0]?.usage.organizations).toMatchObject({
      state: "PRESENT",
      value: 2
    });
    expect(result.capUsage.lanes[0]?.usage.sourceUrls).toMatchObject({
      state: "PRESENT",
      value: 2
    });
    expect(result.capUsage.lanes[0]?.usage.drafts).toMatchObject({
      state: "PRESENT",
      value: 0
    });
    expect(result.capUsage.lanes[1]?.usage.organizations.state).toBe("MISSING");
    expect(JSON.stringify(result)).not.toMatch(
      /private-company-tripwire|private-audit-tripwire|never-expose-token/
    );
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("accepts non-synthetic shortlisted company metadata in the explicitly public scope", () => {
    const snapshot = publicDashboardSnapshot();
    snapshot.runs[0]!.summary!.companyShortlist = [
      { synthetic: false, companyName: "private-shortlist-tripwire" }
    ];
    expect(read(snapshot).safetyContext.dataset.value).toBe("PUBLIC_RESEARCH");
    expect(JSON.stringify(read(snapshot))).not.toContain(
      "private-shortlist-tripwire"
    );
  });

  it("projects the known activity snapshot audit event without its raw details", () => {
    const feed = read().safeAuditFeed;
    expect(feed.totalEvents.value).toBe(3);
    expect(feed.entries[0]).toMatchObject({
      sequence: 3,
      eventType: "MARKET_SCOUT_ACTIVITY_SNAPSHOT",
      result: "RECORDED"
    });
    expect(feed.entries[0]).not.toHaveProperty("details");
    expect(read(undefined, "VIEWER").safeAuditFeed).toMatchObject({
      access: "HEALTH_ONLY",
      entries: [],
      nextCursor: null
    });
  });

  it.each(["SYNTHETIC", "WARM_REFERRAL", "UNRECOGNIZED"])(
    "rejects non-public provenance %s",
    (sourceKind) => {
      const snapshot = publicDashboardSnapshot();
      Object.assign(snapshot.companies[0]!, { sourceKind });
      expect(() => read(snapshot)).toThrow(
        "Dashboard read model is unavailable"
      );
    }
  );

  it("does not relabel mixed synthetic and public history as purely public", () => {
    const snapshot = publicDashboardSnapshot();
    snapshot.companies.push({
      ...snapshot.companies[0]!,
      id: "synthetic-row",
      sourceKind: "SYNTHETIC",
      synthetic: true
    });
    expect(() => read(snapshot)).toThrow("Dashboard read model is unavailable");
  });

  it("rejects a company belonging to another tenant", () => {
    const snapshot = publicDashboardSnapshot();
    snapshot.companies[0]!.tenantId = "10000000-0000-4000-8000-000000000002";
    expect(() => read(snapshot)).toThrow("Dashboard read model is unavailable");
  });

  it.each(["spend", "outbound", "audit"])(
    "retains the %s invariant in public scope",
    (boundary) => {
      const snapshot = publicDashboardSnapshot();
      if (boundary === "spend")
        Object.assign(snapshot.runs[0]!.summary!.metrics!, { paidSpend: 1 });
      if (boundary === "outbound")
        snapshot.runs[0]!.summary!.outboundActions = 1;
      if (boundary === "audit") snapshot.audit[0]!.eventType = "UNKNOWN_EVENT";
      expect(() => read(snapshot)).toThrow(
        "Dashboard read model is unavailable"
      );
    }
  );
});
