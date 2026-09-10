import { describe, expect, it } from "vitest";
import { runAllLanes } from "@/modules/growth/application/run-parallel";
import { syntheticFixtures } from "@/modules/growth/demo/fixtures";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

describe("synthetic three-lane vertical slice", () => {
  it("produces honest bounded reports with no external action", async () => {
    const repository = new InMemoryGrowthRepository();
    const actor = {
      tenantId: "10000000-0000-4000-8000-000000000001",
      actorId: "20000000-0000-4000-8000-000000000001",
      role: "OWNER" as const
    };
    const result = await runAllLanes({
      actor,
      batchKey: "demo-e2e",
      inputsByLane: syntheticFixtures,
      repository
    });

    expect(result.aggregate.lanesCompleted).toBe(3);
    expect(result.aggregate.outboundActions).toBe(0);
    expect(Object.values(syntheticFixtures).flat()).toHaveLength(12);

    for (const outcome of Object.values(result.laneResults)) {
      expect(outcome.status).toBe("fulfilled");
      if (outcome.status !== "fulfilled") continue;
      expect(outcome.report.marketShortlist.map((item) => item.marketKey).sort()).toEqual(
        ["ae-dubai", "fr-france", "iq-kri-erbil", "tr-istanbul"]
      );
      expect(outcome.report.drafts.every((draft) => draft.synthetic)).toBe(true);
      expect(outcome.report.drafts.every((draft) => draft.outboundEnabled === false)).toBe(true);
      expect(outcome.report.complianceDecisions).toHaveLength(4);
      expect(outcome.report.complianceDecisions.every((item) => item.authorizationToken === null)).toBe(true);
    }

    const dashboard = await repository.getDashboard(actor);
    expect(dashboard.companies.every((company) => company.synthetic)).toBe(true);
    expect(dashboard.audit.length).toBeGreaterThan(0);
    expect(dashboard.drafts.every((draft) => draft.body.includes("ارسال نشده"))).toBe(true);
    expect(
      dashboard.drafts
        .filter((draft) => draft.laneKey !== "serviceflow")
        .every((draft) => draft.body.includes("محصول آماده نیست"))
    ).toBe(true);
  });
});
