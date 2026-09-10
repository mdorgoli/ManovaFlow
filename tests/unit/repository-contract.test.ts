import { describe, expect, it } from "vitest";
import { parseCandidate } from "@/modules/growth/domain/candidate-schema";
import type { ActorContext } from "@/modules/growth/domain/types";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

const tenantA: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
};
const tenantB: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000002",
  actorId: "20000000-0000-4000-8000-000000000002",
  role: "OWNER"
};

function candidate(laneKey: "serviceflow" | "beautyflow" = "serviceflow") {
  return parseCandidate({
    laneKey,
    marketKey: "fr-france",
    companyName: "Atelier Shared — DEMO FICTIONAL",
    domain: "atelier-shared.example",
    country: "FR",
    sourceUrl: "https://atelier-shared.example/services",
    sourceKind: "SYNTHETIC",
    synthetic: true,
    signalKeys:
      laneKey === "serviceflow"
        ? ["non_emergency_maintenance"]
        : ["non_medical_beauty"],
    marketSignalKeys: ["documented_icp_density"],
    riskFlags: []
  });
}

describe("InMemoryGrowthRepository contract", () => {
  it("deduplicates a company tenant-wide across lanes but isolates tenants", async () => {
    const repository = new InMemoryGrowthRepository();

    const first = await repository.saveCompany(tenantA, candidate("serviceflow"));
    const duplicate = await repository.saveCompany(tenantA, candidate("beautyflow"));
    const otherTenant = await repository.saveCompany(tenantB, candidate("serviceflow"));

    expect(first.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.company.id).toBe(first.company.id);
    expect(otherTenant.company.id).not.toBe(first.company.id);
    expect((await repository.getDashboard(tenantA)).companies).toHaveLength(1);
    expect((await repository.getDashboard(tenantB)).companies).toHaveLength(1);
  });

  it("applies suppression tenant-wide regardless of lane", async () => {
    const repository = new InMemoryGrowthRepository();
    await repository.suppressDomain(tenantA, "Atelier-Shared.Example", "manual DNC");

    expect(await repository.isSuppressed(tenantA, "atelier-shared.example")).toBe(true);
    expect(await repository.isSuppressed(tenantB, "atelier-shared.example")).toBe(false);
  });

  it("reuses a research run only for the same tenant, lane, and idempotency key", async () => {
    const repository = new InMemoryGrowthRepository();

    const first = await repository.beginRun(tenantA, "serviceflow", "batch-001");
    const replay = await repository.beginRun(tenantA, "serviceflow", "batch-001");
    const otherLane = await repository.beginRun(tenantA, "beautyflow", "batch-001");
    const otherTenant = await repository.beginRun(tenantB, "serviceflow", "batch-001");

    expect(replay).toEqual({ run: first.run, reused: true });
    expect(otherLane.run.id).not.toBe(first.run.id);
    expect(otherTenant.run.id).not.toBe(first.run.id);
  });

  it("stores company and market scores as separate records", async () => {
    const repository = new InMemoryGrowthRepository();
    const saved = await repository.saveCompany(tenantA, candidate());

    await repository.saveCompanyScore(tenantA, {
      runId: "30000000-0000-4000-8000-000000000001",
      companyId: saved.company.id,
      laneKey: "serviceflow",
      total: 65,
      status: "ELIGIBLE",
      explanation: []
    });
    await repository.saveMarketScore(tenantA, {
      runId: "30000000-0000-4000-8000-000000000001",
      laneKey: "serviceflow",
      marketKey: "fr-france",
      total: 55,
      confidence: "MEDIUM",
      explanation: []
    });

    const dashboard = await repository.getDashboard(tenantA);
    expect(dashboard.companyScores).toHaveLength(1);
    expect(dashboard.marketScores).toHaveLength(1);
    expect(dashboard.companyScores[0]?.total).toBe(65);
    expect(dashboard.marketScores[0]?.total).toBe(55);
  });

  it("does not overwrite a recorded compliance decision", async () => {
    const repository = new InMemoryGrowthRepository();
    const input = {
      decisionKey: "serviceflow:fr-france:HUMAN_SEND",
      laneKey: "serviceflow" as const,
      marketKey: "fr-france" as const,
      targetStage: "HUMAN_SEND" as const,
      status: "HUMAN_SEND_BLOCKED",
      authorizationToken: null,
      recordedAt: "2026-09-04T08:00:00.000Z"
    };

    await repository.saveComplianceDecision(tenantA, input);
    await expect(
      repository.saveComplianceDecision(tenantA, {
        ...input,
        status: "RECORDED_DECISION_REQUIRED"
      })
    ).rejects.toThrow(/immutable|already exists/i);

    const stored = await repository.findComplianceDecision(
      tenantA,
      input.decisionKey
    );
    expect(stored?.status).toBe("HUMAN_SEND_BLOCKED");
    expect(stored?.authorizationToken).toBeNull();
  });

  it("returns append-only audit events in sequence and protects stored values", async () => {
    const repository = new InMemoryGrowthRepository({
      now: (() => {
        let tick = 0;
        return () => new Date(1_780_000_000_000 + tick++);
      })()
    });

    const first = await repository.appendAudit(tenantA, {
      eventType: "RUN_STARTED",
      laneKey: "serviceflow",
      entityId: "run-a",
      details: { safe: true }
    });
    await repository.appendAudit(tenantA, {
      eventType: "RUN_COMPLETED",
      laneKey: "serviceflow",
      entityId: "run-a",
      details: { count: 1 }
    });
    first.details.safe = false;

    const audit = (await repository.getDashboard(tenantA)).audit;
    expect(audit.map((event) => event.sequence)).toEqual([1, 2]);
    expect(audit[0]?.details).toEqual({ safe: true });
  });
});
