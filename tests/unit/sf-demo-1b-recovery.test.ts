import { describe, expect, it } from "vitest";
import type { MarketScoutSource } from "@/modules/growth/application/market-scout-contracts";
import type { MarketScoutWebsiteReviewer } from "@/modules/growth/application/market-scout-website-review";
import {
  SF_DEMO_1B_IDEMPOTENCY_KEY,
  SfDemo1BExecutionError,
  SfDemo1BExecutor
} from "@/modules/growth/application/sf-demo-1b-execution";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

const actor = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
} as const;

describe("SF-DEMO-1B recovery boundary", () => {
  it.each(["RUNNING", "COMPLETED", "FAILED"] as const)(
    "does not repeat discovery for a stored %s run without its activity snapshot",
    async (status) => {
      const repository = new InMemoryGrowthRepository();
      const { run } = await repository.beginRun(
        actor,
        "serviceflow",
        SF_DEMO_1B_IDEMPOTENCY_KEY
      );
      if (status === "COMPLETED") {
        await repository.completeRun(actor, run.id, { fixture: "interrupted-before-activity" });
      } else if (status === "FAILED") {
        await repository.failRun(actor, run.id, "interrupted-before-activity");
      }
      const storedBefore = await repository.getDashboard(actor);
      const probe = sourceProbe();

      await expect(new SfDemo1BExecutor().execute({
        actor,
        repository,
        source: probe.source,
        websiteReviewer: unusedReviewer
      })).rejects.toBeInstanceOf(SfDemo1BExecutionError);

      expect(probe.calls()).toBe(0);
      expect(await repository.getDashboard(actor)).toEqual(storedBefore);
    }
  );

  it("replays a complete snapshot through a fresh executor without another discovery", async () => {
    const repository = new InMemoryGrowthRepository();
    const probe = sourceProbe();
    const input = { actor, repository, source: probe.source, websiteReviewer: unusedReviewer };
    const first = await new SfDemo1BExecutor().execute(input);
    const beforeReplay = await repository.getDashboard(actor);

    const replay = await new SfDemo1BExecutor().execute(input);

    expect(first.disposition).toBe("CREATED");
    expect(replay.disposition).toBe("REUSED");
    expect(replay.snapshot).toEqual(first.snapshot);
    expect(probe.calls()).toBe(1);
    expect(await repository.getDashboard(actor)).toEqual(beforeReplay);
  });
});

function sourceProbe() {
  let count = 0;
  const source: MarketScoutSource = {
    async discover() {
      count += 1;
      return { sourceUrlsReviewed: 1, paidSpend: 0, candidates: [] };
    }
  };
  return { source, calls: () => count };
}

const unusedReviewer: MarketScoutWebsiteReviewer = {
  async review() {
    throw new Error("A source with no candidates must not review a website");
  }
};
