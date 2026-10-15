import { describe, expect, it } from "vitest";
import {
  DASHBOARD_READ_MODEL_VERSION,
  DASHBOARD_SECTION_VERSIONS
} from "@/modules/growth/application/dashboard-contracts";
import {
  buildDashboardReadModel,
  DashboardReadModelError,
  type DashboardReadModelInput
} from "@/modules/growth/application/dashboard-read-model";
import type {
  DashboardSnapshot,
  ResearchRunRecord
} from "@/modules/growth/application/repository";
import type { ActorContext } from "@/modules/growth/domain/types";

const actor: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
};

const generatedAt = "2026-09-04T12:00:00.000Z";

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

function input(
  snapshot: DashboardSnapshot,
  role: ActorContext["role"] = "OWNER"
): DashboardReadModelInput {
  return {
    actor: { ...actor, role },
    snapshot,
    generatedAt,
    runtime: {
      mode: "DEMO",
      dataset: "SYNTHETIC",
      storageMode: "MEMORY_DEMO",
      outboundGateway: "DISABLED",
      outboundCredentials: "ABSENT"
    }
  };
}

describe("Dashboard Phase 1 read model", () => {
  it("versions every section and represents absent observations as MISSING rather than zero", () => {
    const model = buildDashboardReadModel(input(emptySnapshot()));

    expect(model.contractVersion).toBe(DASHBOARD_READ_MODEL_VERSION);
    expect(model.safetyContext.contractVersion).toBe(
      DASHBOARD_SECTION_VERSIONS.safetyContext
    );
    expect(model.laneSummary.contractVersion).toBe(
      DASHBOARD_SECTION_VERSIONS.laneSummary
    );
    expect(model.capUsage.contractVersion).toBe(
      DASHBOARD_SECTION_VERSIONS.capUsage
    );
    expect(model.marketRanking.contractVersion).toBe(
      DASHBOARD_SECTION_VERSIONS.marketRanking
    );
    expect(model.evidenceMatrix.contractVersion).toBe(
      DASHBOARD_SECTION_VERSIONS.evidenceMatrix
    );
    expect(model.safeAuditFeed.contractVersion).toBe(
      DASHBOARD_SECTION_VERSIONS.safeAuditFeed
    );

    expect(model.missingSemantics.zeroFromAbsence).toBe(false);
    expect(model.safetyContext.outbound).toMatchObject({
      state: "PRESENT",
      value: { enabled: false, actions: 0, sideEffects: 0 }
    });
    expect(model.laneSummary.lanes).toHaveLength(3);
    expect(model.laneSummary.lanes[0]?.latestRun).toMatchObject({
      state: "MISSING",
      reason: "NO_RECORDED_RUN"
    });
    expect(model.capUsage.lanes[0]?.window).toMatchObject({
      state: "MISSING",
      reason: "LEDGER_NOT_IMPLEMENTED"
    });
    expect(model.capUsage.lanes[0]?.usage.sourceUrls).toMatchObject({
      state: "MISSING",
      reason: "NO_COMPLETED_RUN"
    });
    expect(model.marketRanking.lanes[0]?.markets[0]?.score).toMatchObject({
      state: "MISSING",
      reason: "NO_COMPLETED_RUN"
    });
    expect(JSON.stringify(model)).not.toContain(actor.tenantId);
    expect(JSON.stringify(model)).not.toContain(actor.actorId);
  });

  it("projects recorded run usage and per-lane market ranks with provenance", () => {
    const snapshot = emptySnapshot();
    const run = completedRun();
    snapshot.runs.push(run);
    snapshot.marketScores.push(
      {
        id: "40000000-0000-4000-8000-000000000001",
        tenantId: actor.tenantId,
        runId: run.id,
        laneKey: "serviceflow",
        marketKey: "fr-france",
        total: 70,
        confidence: "HIGH",
        explanation: [],
        createdAt: "2026-09-04T11:55:01.000Z"
      },
      {
        id: "40000000-0000-4000-8000-000000000002",
        tenantId: actor.tenantId,
        runId: run.id,
        laneKey: "serviceflow",
        marketKey: "tr-istanbul",
        total: 70,
        confidence: "MEDIUM",
        explanation: [],
        createdAt: "2026-09-04T11:55:02.000Z"
      }
    );

    const model = buildDashboardReadModel(input(snapshot));
    const lane = model.laneSummary.lanes.find(
      (item) => item.laneKey === "serviceflow"
    );
    const usage = model.capUsage.lanes.find(
      (item) => item.laneKey === "serviceflow"
    );
    const ranking = model.marketRanking.lanes.find(
      (item) => item.laneKey === "serviceflow"
    );

    expect(lane?.latestRun).toMatchObject({
      state: "PRESENT",
      value: {
        runReference: "run:30000000-0000-4000-8000-000000000001",
        status: "COMPLETED",
        stopReason: { state: "PRESENT", value: "INPUT_EXHAUSTED" }
      }
    });
    expect(usage?.sourceRun).toMatchObject({
      state: "PRESENT",
      value: {
        runReference: "run:30000000-0000-4000-8000-000000000001"
      }
    });
    expect(usage?.usage.sourceUrls).toMatchObject({
      state: "PRESENT",
      value: 3,
      provenance: [{ source: "RESEARCH_RUN" }]
    });
    expect(usage?.usage.organizations).toMatchObject({
      state: "PRESENT",
      value: 2
    });
    expect(usage?.usage.markets).toMatchObject({
      state: "PRESENT",
      value: 2
    });
    expect(usage?.usage.drafts).toMatchObject({
      state: "PRESENT",
      value: 0
    });
    expect(usage?.usage.elapsedMs).toMatchObject({
      state: "MISSING",
      reason: "NOT_PERSISTED"
    });

    const france = ranking?.markets.find(
      (item) => item.marketKey === "fr-france"
    );
    const istanbul = ranking?.markets.find(
      (item) => item.marketKey === "tr-istanbul"
    );
    const erbil = ranking?.markets.find(
      (item) => item.marketKey === "iq-kri-erbil"
    );
    expect(france?.rank).toMatchObject({ state: "PRESENT", value: 1 });
    expect(istanbul?.rank).toMatchObject({ state: "PRESENT", value: 1 });
    expect(france?.score).toMatchObject({
      state: "PRESENT",
      value: 70,
      provenance: [{ source: "MARKET_SCORE" }]
    });
    expect(erbil?.score).toMatchObject({
      state: "MISSING",
      reason: "NO_MARKET_SCORE"
    });
  });

  it("classifies evidence as FACT, INFERENCE, UNKNOWN, or MISSING without opening Human-Send", () => {
    const current = buildDashboardReadModel(input(emptySnapshot()));
    const france = current.evidenceMatrix.markets.find(
      (market) => market.marketKey === "fr-france"
    );

    expect(
      france?.cells.find((cell) => cell.category === "OUTREACH")
    ).toMatchObject({
      state: "FACT",
      humanSend: "BLOCKED",
      provenance: [{ source: "COMPLIANCE_EVIDENCE" }]
    });
    expect(
      france?.cells.find((cell) => cell.category === "AI_DISCLOSURE")
    ).toMatchObject({ state: "INFERENCE", humanSend: "BLOCKED" });
    expect(
      france?.cells.find((cell) => cell.category === "CONTRACT")
    ).toMatchObject({
      state: "UNKNOWN",
      humanSend: "BLOCKED"
    });
    expect(france?.humanSend).toBe("BLOCKED");

    const stale = buildDashboardReadModel({
      ...input(emptySnapshot()),
      generatedAt: "2027-01-01T00:00:00.000Z"
    });
    const staleOutreach = stale.evidenceMatrix.markets
      .find((market) => market.marketKey === "fr-france")
      ?.cells.find((cell) => cell.category === "OUTREACH");
    expect(staleOutreach).toMatchObject({
      state: "MISSING",
      humanSend: "BLOCKED",
      provenance: [{ source: "MARKET_PROFILE" }]
    });
  });

  it("fails closed when any repository record belongs to another tenant", () => {
    const snapshot = emptySnapshot();
    snapshot.companies.push({
      id: "50000000-0000-4000-8000-000000000001",
      tenantId: "10000000-0000-4000-8000-000000000002",
      companyName: "Cross Tenant DEMO FICTIONAL",
      domain: "cross-tenant.example",
      normalizedDomain: "cross-tenant.example",
      country: "FR",
      sourceUrl: "https://cross-tenant.example/services",
      sourceKind: "SYNTHETIC",
      synthetic: true,
      createdAt: generatedAt
    });

    expectDashboardError(
      () => buildDashboardReadModel(input(snapshot)),
      "DASHBOARD_TENANT_SCOPE_VIOLATION"
    );
  });

  it("fails closed when demo data is not explicitly synthetic", () => {
    const snapshot = emptySnapshot();
    snapshot.companies.push({
      id: "50000000-0000-4000-8000-000000000001",
      tenantId: actor.tenantId,
      companyName: "Unverified Company",
      domain: "unverified.example",
      normalizedDomain: "unverified.example",
      country: "FR",
      sourceUrl: "https://unverified.example/services",
      sourceKind: "PUBLIC_COMPANY_WEBSITE",
      synthetic: false,
      createdAt: generatedAt
    });

    expectDashboardError(
      () => buildDashboardReadModel(input(snapshot)),
      "DASHBOARD_SYNTHETIC_SCOPE_VIOLATION"
    );
  });

  it("fails closed when a source contradicts the outbound invariant", () => {
    const snapshot = emptySnapshot();
    const run = completedRun();
    const summary = structuredClone(run.summary) as Record<string, unknown>;
    summary.outboundActions = 1;
    snapshot.runs.push({ ...run, summary });

    expectDashboardError(
      () => buildDashboardReadModel(input(snapshot)),
      "DASHBOARD_OUTBOUND_INVARIANT_VIOLATION"
    );
  });

  it("turns malformed source data into a typed generic failure without echoing it", () => {
    const snapshot = emptySnapshot();
    snapshot.runs.push({
      ...completedRun(),
      summary: { unsafeRawValue: "do-not-echo-this-secret" }
    });

    let captured: unknown;
    try {
      buildDashboardReadModel(input(snapshot));
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(DashboardReadModelError);
    expect(captured).toMatchObject({
      code: "DASHBOARD_SOURCE_INTEGRITY_VIOLATION",
      message: "Dashboard read model is unavailable"
    });
    expect(String(captured)).not.toContain("do-not-echo-this-secret");
  });

  it("projects a bounded audit page without raw details or identity values", () => {
    const snapshot = emptySnapshot();
    snapshot.audit.push(
      auditEvent(1, "RUN_STARTED"),
      auditEvent(2, "RUN_COMPLETED"),
      auditEvent(3, "DRAFT_DECIDED_INTERNAL_ONLY")
    );
    const firstInput = input(snapshot);
    firstInput.auditPage = { limit: 2 };

    const first = buildDashboardReadModel(firstInput).safeAuditFeed;
    expect(first.access).toBe("DETAIL");
    expect(first.totalEvents).toMatchObject({ state: "PRESENT", value: 3 });
    expect(first.lastSequence).toMatchObject({ state: "PRESENT", value: 3 });
    expect(first.entries.map((event) => event.sequence)).toEqual([3, 2]);
    expect(first.entries[0]).toMatchObject({
      eventType: "DRAFT_DECIDED_INTERNAL_ONLY",
      result: "RECORDED",
      eventReference: "audit:3",
      provenance: [{ source: "AUDIT_EVENT" }]
    });
    expect(first.nextCursor).toBe("2");
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("do-not-echo-this-secret");
    expect(serialized).not.toContain(actor.actorId);
    expect(serialized).not.toContain(actor.tenantId);
    expect(serialized).not.toContain("unsafe-entity-reference");

    const secondInput = input(snapshot);
    secondInput.auditPage = { beforeSequence: 2, limit: 2 };
    const second = buildDashboardReadModel(secondInput).safeAuditFeed;
    expect(second.entries.map((event) => event.sequence)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
  });

  it("limits Viewer audit access to health metadata", () => {
    const snapshot = emptySnapshot();
    snapshot.audit.push(auditEvent(1, "RUN_STARTED"));

    const feed = buildDashboardReadModel(
      input(snapshot, "VIEWER")
    ).safeAuditFeed;

    expect(feed.access).toBe("HEALTH_ONLY");
    expect(feed.entries).toEqual([]);
    expect(feed.totalEvents).toMatchObject({ state: "PRESENT", value: 1 });
    expect(feed.lastSequence).toMatchObject({ state: "PRESENT", value: 1 });
    expect(feed.nextCursor).toBeNull();
  });

  it("fails closed on a broken audit sequence or an unrecognized event type", () => {
    const gap = emptySnapshot();
    gap.audit.push(
      auditEvent(1, "RUN_STARTED"),
      auditEvent(3, "RUN_COMPLETED")
    );
    expectDashboardError(
      () => buildDashboardReadModel(input(gap)),
      "DASHBOARD_AUDIT_INTEGRITY_VIOLATION"
    );

    const unknown = emptySnapshot();
    unknown.audit.push(auditEvent(1, "UNRECOGNIZED_EVENT"));
    expectDashboardError(
      () => buildDashboardReadModel(input(unknown)),
      "DASHBOARD_AUDIT_INTEGRITY_VIOLATION"
    );
  });

  it("fails closed when recorded consumption exceeds its configured cap", () => {
    const snapshot = emptySnapshot();
    const run = completedRun();
    const summary = structuredClone(run.summary) as {
      metrics: { sourceUrlsReviewed: number };
    };
    summary.metrics.sourceUrlsReviewed = 41;
    snapshot.runs.push({ ...run, summary });

    expectDashboardError(
      () => buildDashboardReadModel(input(snapshot)),
      "DASHBOARD_SOURCE_INTEGRITY_VIOLATION"
    );
  });

  it("fails closed when a market score has no matching run", () => {
    const snapshot = emptySnapshot();
    snapshot.marketScores.push({
      id: "40000000-0000-4000-8000-000000000001",
      tenantId: actor.tenantId,
      runId: "30000000-0000-4000-8000-000000000099",
      laneKey: "serviceflow",
      marketKey: "fr-france",
      total: 70,
      confidence: "HIGH",
      explanation: [],
      createdAt: "2026-09-04T11:55:01.000Z"
    });

    expectDashboardError(
      () => buildDashboardReadModel(input(snapshot)),
      "DASHBOARD_SOURCE_INTEGRITY_VIOLATION"
    );
  });
});

function completedRun(): ResearchRunRecord {
  const id = "30000000-0000-4000-8000-000000000001";
  return {
    id,
    tenantId: actor.tenantId,
    laneKey: "serviceflow",
    idempotencyKey: "dashboard-phase-1",
    status: "COMPLETED",
    startedAt: "2026-09-04T11:55:00.000Z",
    completedAt: "2026-09-04T11:56:00.000Z",
    error: null,
    summary: {
      runId: id,
      laneKey: "serviceflow",
      displayName: "ServiceFlow",
      status: "COMPLETED",
      state: "RESEARCH_ONLY",
      packState: "ACTIVE_DEVELOPMENT",
      marketShortlist: [
        { marketKey: "fr-france" },
        { marketKey: "tr-istanbul" }
      ],
      companyShortlist: [],
      metrics: {
        sourceUrlsReviewed: 3,
        organizationsConsidered: 2,
        eligibleCompanies: 0,
        deduplicatedCompanies: 1,
        suppressedCompanies: 0,
        draftsCreated: 0,
        paidSpend: 0,
        stoppedBy: "INPUT_EXHAUSTED"
      },
      outboundActions: 0
    }
  };
}

function expectDashboardError(
  operation: () => unknown,
  code: DashboardReadModelError["code"]
): void {
  let captured: unknown;
  try {
    operation();
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeInstanceOf(DashboardReadModelError);
  expect(captured).toMatchObject({
    code,
    message: "Dashboard read model is unavailable"
  });
}

function auditEvent(sequence: number, eventType: string) {
  return {
    id: `60000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    tenantId: actor.tenantId,
    sequence,
    eventType,
    laneKey: "serviceflow" as const,
    entityId: "unsafe-entity-reference",
    actorId: actor.actorId,
    details: {
      authorization: "do-not-echo-this-secret",
      nested: { cookie: "do-not-echo-this-secret" }
    },
    createdAt: `2026-09-04T11:5${sequence}:00.000Z`
  };
}
