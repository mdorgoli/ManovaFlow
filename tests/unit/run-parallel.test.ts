import { describe, expect, it } from "vitest";
import type { GrowthRepository } from "@/modules/growth/application/repository";
import { runAllLanes } from "@/modules/growth/application/run-parallel";
import type { LaneReport } from "@/modules/growth/application/run-lane";
import { parseCandidate } from "@/modules/growth/domain/candidate-schema";
import type { ActorContext, LaneKey } from "@/modules/growth/domain/types";
import { syntheticFixtures } from "@/modules/growth/demo/fixtures";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

const actor: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OPERATOR"
};

describe("parallel Research-Only orchestration", () => {
  it("runs all three lanes with separate market and company scoring", async () => {
    const repository = new InMemoryGrowthRepository();
    const result = await runAllLanes({
      actor,
      batchKey: "parallel-001",
      inputsByLane: syntheticFixtures,
      repository
    });

    expect(result.aggregate).toMatchObject({
      lanesCompleted: 3,
      lanesFailed: 0,
      marketEvaluations: 12,
      outboundActions: 0
    });

    for (const laneKey of ["serviceflow", "beautyflow", "briefflow"] as const) {
      const report = fulfilled(result.laneResults[laneKey]);
      expect(report.state).toBe("RESEARCH_ONLY");
      expect(report.marketShortlist).toHaveLength(4);
      expect(report.companyShortlist.length).toBeGreaterThan(0);
      expect(report.companyShortlist[0]?.fitScore).not.toBe(
        report.marketShortlist[0]?.readinessScore
      );
      expect(report.outboundActions).toBe(0);
      expect(
        report.complianceDecisions.every(
          (decision) => decision.authorizationToken === null
        )
      ).toBe(true);
    }
  });

  it("isolates a repeatedly failing lane while the other two complete", async () => {
    const base = new InMemoryGrowthRepository();
    const repository = failLaneAtStart(base, "beautyflow");
    const result = await runAllLanes({
      actor,
      batchKey: "parallel-failure",
      inputsByLane: syntheticFixtures,
      repository,
      retry: { maxAttempts: 3, baseDelayMs: 0 }
    });

    expect(result.laneResults.serviceflow.status).toBe("fulfilled");
    expect(result.laneResults.briefflow.status).toBe("fulfilled");
    expect(result.laneResults.beautyflow).toMatchObject({
      status: "rejected",
      error: "simulated transient lane failure",
      attempts: 3
    });
    expect(result.aggregate).toMatchObject({ lanesCompleted: 2, lanesFailed: 1 });
  });

  it("honors tenant-wide suppression before scoring", async () => {
    const repository = new InMemoryGrowthRepository();
    const blocked = syntheticFixtures.beautyflow[0];
    expect(blocked).toBeDefined();
    await repository.suppressDomain(actor, blocked!.domain, "manual DNC");

    const result = await runAllLanes({
      actor,
      batchKey: "parallel-suppression",
      inputsByLane: syntheticFixtures,
      repository
    });
    const beauty = fulfilled(result.laneResults.beautyflow);

    expect(beauty.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: blocked!.domain,
          reasons: ["TENANT_SUPPRESSED"]
        })
      ])
    );
    expect(beauty.companyShortlist.map((item) => item.domain)).not.toContain(
      blocked!.domain
    );
  });

  it("stops only the affected lane after consecutive low-value additions", async () => {
    const lowValue = [0, 1, 2].map((index) =>
      parseCandidate({
        laneKey: "serviceflow",
        marketKey: "fr-france",
        companyName: "Low Value " + index + " — DEMO FICTIONAL",
        domain: "low-value-" + index + ".example",
        country: "FR",
        sourceUrl: "https://low-value-" + index + ".example/about",
        sourceKind: "SYNTHETIC",
        synthetic: true,
        signalKeys: [],
        marketSignalKeys: [],
        riskFlags: [],
      })
    );
    const result = await runAllLanes({
      actor,
      batchKey: "parallel-diminishing",
      inputsByLane: {
        ...syntheticFixtures,
        serviceflow: lowValue
      },
      repository: new InMemoryGrowthRepository()
    });

    const service = fulfilled(result.laneResults.serviceflow);
    expect(service.metrics.organizationsConsidered).toBe(2);
    expect(service.metrics.stoppedBy).toBe("DIMINISHING_RETURNS");
    expect(result.laneResults.beautyflow.status).toBe("fulfilled");
    expect(result.laneResults.briefflow.status).toBe("fulfilled");
  });

  it("contains a prohibited-risk kill inside its own lane", async () => {
    const riskyService = parseCandidate({
      ...syntheticFixtures.serviceflow[0]!,
      riskFlags: ["emergency_dispatch"]
    });
    const result = await runAllLanes({
      actor,
      batchKey: "parallel-risk",
      inputsByLane: {
        ...syntheticFixtures,
        serviceflow: [riskyService]
      },
      repository: new InMemoryGrowthRepository()
    });

    const service = fulfilled(result.laneResults.serviceflow);
    const beauty = fulfilled(result.laneResults.beautyflow);
    expect(service.companyShortlist).toHaveLength(0);
    expect(service.rejections[0]?.reasons).toContain("emergency_dispatch");
    expect(beauty.companyShortlist.length).toBeGreaterThan(0);
  });
});

function fulfilled(
  result:
    | { status: "fulfilled"; report: LaneReport; attempts: number }
    | { status: "rejected"; error: string; attempts: number }
): LaneReport {
  expect(result.status).toBe("fulfilled");
  if (result.status !== "fulfilled") {
    throw new Error(result.error);
  }
  return result.report;
}

function failLaneAtStart(
  repository: InMemoryGrowthRepository,
  laneKey: LaneKey
): GrowthRepository {
  return new Proxy(repository, {
    get(target, property, receiver) {
      if (property === "beginRun") {
        return async (
          context: ActorContext,
          requestedLane: LaneKey,
          key: string
        ) => {
          if (requestedLane === laneKey) {
            const { RetryableError } = await import(
              "@/modules/growth/application/retry"
            );
            throw new RetryableError("simulated transient lane failure");
          }
          return target.beginRun(context, requestedLane, key);
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    }
  }) as GrowthRepository;
}
