import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSnapshot } from "@/modules/growth/application/repository";
import type { ActorContext } from "@/modules/growth/domain/types";
import { publicDashboardSnapshot } from "../helpers/dashboard-public-fixture";

const state = vi.hoisted(() => ({
  snapshot: null as unknown as DashboardSnapshot,
  actor: {
    tenantId: "10000000-0000-4000-8000-000000000001",
    actorId: "20000000-0000-4000-8000-000000000001",
    role: "OWNER"
  } as ActorContext
}));

vi.mock("@/lib/container", () => ({
  getGrowthRepository: () => ({
    getDashboard: async () => structuredClone(state.snapshot)
  }),
  getStorageMode: () => "MEMORY_DEMO"
}));

vi.mock("@/lib/request-auth", () => ({
  resolveRequestActor: async () => structuredClone(state.actor)
}));

import { GET } from "@/app/api/dashboard/route";

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("NODE_ENV", "test");
  state.snapshot = emptySnapshot();
});

describe("GET /api/dashboard", () => {
  it("returns public research with honest provenance through the real read-model boundary", async () => {
    state.snapshot = publicDashboardSnapshot();
    const response = await GET(new Request("https://app.example.test/api/dashboard"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.safetyContext.dataset.value).toBe("PUBLIC_RESEARCH");
    expect(JSON.stringify(payload)).not.toMatch(/private-company-tripwire|private-audit-tripwire|never-expose-token/);
  });

  it("returns only the versioned read-model envelope with private no-store caching", async () => {
    const response = await GET(
      new Request("https://app.example.test/api/dashboard")
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(payload.contractVersion).toBe("manovaflow.dashboard.v2");
    expect(payload).toHaveProperty("safetyContext.contractVersion");
    expect(payload).toHaveProperty("safeAuditFeed.contractVersion");
    expect(payload).not.toHaveProperty("snapshot");
    expect(payload).not.toHaveProperty("runs");
  });

  it("returns a generic 503 when the read model rejects unsafe source data", async () => {
    state.snapshot.companies.push({
      id: "50000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000002",
      companyName: "do-not-echo-this-secret",
      domain: "cross-tenant.example",
      normalizedDomain: "cross-tenant.example",
      country: "FR",
      sourceUrl: "https://cross-tenant.example/services",
      sourceKind: "SYNTHETIC",
      synthetic: true,
      createdAt: "2026-09-04T12:00:00.000Z"
    });

    const response = await GET(
      new Request("https://app.example.test/api/dashboard")
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      error: {
        code: "DASHBOARD_UNAVAILABLE",
        message: "Dashboard read model is unavailable"
      }
    });
    expect(JSON.stringify(payload)).not.toContain("do-not-echo-this-secret");
  });

  it("passes a bounded audit cursor to the safe feed", async () => {
    state.snapshot.audit.push(
      auditEvent(1, "RUN_STARTED"),
      auditEvent(2, "RUN_COMPLETED"),
      auditEvent(3, "DRAFT_DECIDED_INTERNAL_ONLY")
    );

    const response = await GET(
      new Request(
        "https://app.example.test/api/dashboard?auditBefore=3&auditLimit=1"
      )
    );
    const payload = (await response.json()) as {
      safeAuditFeed: {
        entries: { sequence: number }[];
        nextCursor: string | null;
      };
    };

    expect(response.status).toBe(200);
    expect(
      payload.safeAuditFeed.entries.map((entry) => entry.sequence)
    ).toEqual([2]);
    expect(payload.safeAuditFeed.nextCursor).toBe("2");
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

function auditEvent(sequence: number, eventType: string) {
  return {
    id: `60000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    tenantId: state.actor.tenantId,
    sequence,
    eventType,
    laneKey: "serviceflow" as const,
    entityId: "not-exposed",
    actorId: state.actor.actorId,
    details: { safe: true },
    createdAt: `2026-09-04T11:5${sequence}:00.000Z`
  };
}
