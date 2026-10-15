import { describe, expect, it } from "vitest";
import {
  runMarketScout,
  type MarketScoutCoordinatorInput
} from "@/modules/growth/application/market-scout-coordinator";
import type {
  MarketScoutDiscoveryRequest,
  MarketScoutSource,
  MarketScoutTask
} from "@/modules/growth/application/market-scout-contracts";
import type { ActorContext, LaneKey } from "@/modules/growth/domain/types";
import { growthManifests } from "@/modules/growth/manifests";
import { marketProfiles } from "@/modules/growth/markets";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

const operator: ActorContext = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OPERATOR"
};

describe("Market Scout coordinator", () => {
  it("runs all lane-by-market tasks with real bounded parallelism and exact per-lane budget partitions", async () => {
    const requests: MarketScoutDiscoveryRequest[] = [];
    let active = 0;
    let maxActive = 0;
    const source: MarketScoutSource = {
      async discover(request) {
        requests.push(request);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return discoveryFor(request.task);
      }
    };

    const result = await runMarketScout(input(source, { concurrency: 3 }));

    expect(requests).toHaveLength(12);
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(result.workerOutcomes).toHaveLength(12);
    expect(
      result.workerOutcomes.every((item) => item.status === "fulfilled")
    ).toBe(true);

    for (const laneKey of Object.keys(growthManifests) as LaneKey[]) {
      const laneRequests = requests.filter(
        (request) => request.task.laneKey === laneKey
      );
      expect(laneRequests).toHaveLength(4);
      expect(
        laneRequests.reduce(
          (total, request) => total + request.budget.maxSourceUrls,
          0
        )
      ).toBe(growthManifests[laneKey].dailyCaps.sourceUrls);
      expect(
        laneRequests.reduce(
          (total, request) => total + request.budget.maxOrganizations,
          0
        )
      ).toBe(growthManifests[laneKey].dailyCaps.organizations);
    }

    expect(result.research.aggregate).toMatchObject({
      lanesCompleted: 3,
      lanesFailed: 0,
      eligibleCompanies: 12,
      draftsCreated: 10,
      outboundActions: 0
    });
    expect(result.internalDrafts).toHaveLength(10);
    expect(result.internalDrafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marketKey: "fr-france",
          language: "fr",
          direction: "LTR",
          outboundEnabled: false
        }),
        expect.objectContaining({
          marketKey: "ae-dubai",
          language: "ar",
          direction: "RTL",
          outboundEnabled: false
        }),
        expect.objectContaining({
          marketKey: "tr-istanbul",
          language: "en",
          direction: "LTR",
          outboundEnabled: false
        })
      ])
    );
    expect(
      result.internalDrafts.find((draft) => draft.marketKey === "fr-france")
        ?.body
    ).toContain("NON ENVOYÉ");
    expect(
      result.internalDrafts.find((draft) => draft.marketKey === "ae-dubai")
        ?.body
    ).toContain("لم يتم الإرسال");
    expect(
      result.internalDrafts.find((draft) => draft.marketKey === "tr-istanbul")
        ?.body
    ).toContain("NOT SENT");
  });

  it("checks authorization and coordinator inputs before invoking the source", async () => {
    let calls = 0;
    const source: MarketScoutSource = {
      async discover() {
        calls += 1;
        return discoveryFor({ laneKey: "serviceflow", marketKey: "fr-france" });
      }
    };

    await expect(
      runMarketScout({
        ...input(source),
        actor: { ...operator, role: "VIEWER" }
      })
    ).rejects.toThrow("cannot perform RUN_RESEARCH");
    await expect(
      runMarketScout({ ...input(source), batchKey: "   " })
    ).rejects.toThrow("Batch idempotency key is required");
    await expect(
      runMarketScout({ ...input(source), concurrency: 13 })
    ).rejects.toThrow(
      "Market Scout concurrency must be an integer from 1 through 12"
    );
    expect(calls).toBe(0);
  });

  it("isolates one source failure while the other workers and all lanes complete", async () => {
    const source: MarketScoutSource = {
      async discover(request) {
        if (
          request.task.laneKey === "beautyflow" &&
          request.task.marketKey === "ae-dubai"
        ) {
          throw new Error("provider detail must not escape");
        }
        return discoveryFor(request.task);
      }
    };

    const result = await runMarketScout(input(source));

    expect(result.aggregate).toMatchObject({
      workersCompleted: 11,
      workersFailed: 1,
      outboundActions: 0
    });
    expect(result.workerOutcomes).toContainEqual({
      task: { laneKey: "beautyflow", marketKey: "ae-dubai" },
      status: "rejected",
      errorCode: "MARKET_SCOUT_SOURCE_FAILED"
    });
    expect(JSON.stringify(result)).not.toContain(
      "provider detail must not escape"
    );
    expect(result.research.aggregate.lanesCompleted).toBe(3);
  });

  it("preserves tenant-wide dedupe and suppression across independent workers", async () => {
    const repository = new InMemoryGrowthRepository();
    await repository.suppressDomain(
      operator,
      "blocked-brief-dubai.ae",
      "tenant suppression"
    );
    const source: MarketScoutSource = {
      async discover(request) {
        const candidate = publicCandidate(request.task);
        if (request.task.marketKey === "fr-france") {
          candidate.domain = "shared-public-prospect.fr";
          candidate.sourceUrl = "https://shared-public-prospect.fr/services";
        }
        if (
          request.task.laneKey === "briefflow" &&
          request.task.marketKey === "ae-dubai"
        ) {
          candidate.domain = "blocked-brief-dubai.ae";
          candidate.sourceUrl = "https://blocked-brief-dubai.ae/services";
        }
        return {
          sourceUrlsReviewed: 1,
          paidSpend: 0,
          candidates: [{ candidate, publicText: publicText(request.task) }]
        };
      }
    };

    const result = await runMarketScout({
      ...input(source),
      repository
    });
    const dashboard = await repository.getDashboard(operator);
    const reports = Object.values(result.research.laneResults).flatMap(
      (outcome) => (outcome.status === "fulfilled" ? [outcome.report] : [])
    );

    expect(dashboard.companies).toHaveLength(9);
    expect(
      reports.reduce(
        (total, report) => total + report.metrics.deduplicatedCompanies,
        0
      )
    ).toBe(2);
    expect(
      reports.reduce(
        (total, report) => total + report.metrics.suppressedCompanies,
        0
      )
    ).toBe(1);
    expect(
      reports
        .flatMap((report) => report.companyShortlist)
        .map((item) => item.domain)
    ).not.toContain("blocked-brief-dubai.ae");
  });

  it("emits one shortlist row and one draft when two market workers find the same domain in one lane", async () => {
    const source: MarketScoutSource = {
      async discover(request) {
        const candidate = publicCandidate(request.task);
        if (
          request.task.laneKey === "serviceflow" &&
          (request.task.marketKey === "fr-france" ||
            request.task.marketKey === "tr-istanbul")
        ) {
          candidate.domain = "shared-serviceflow-domain.com";
          candidate.sourceUrl =
            "https://shared-serviceflow-domain.com/services";
        }
        return {
          sourceUrlsReviewed: 1,
          paidSpend: 0,
          candidates: [{ candidate, publicText: publicText(request.task) }]
        };
      }
    };

    const result = await runMarketScout(input(source));
    const serviceOutcome = result.research.laneResults.serviceflow;
    expect(serviceOutcome.status).toBe("fulfilled");
    if (serviceOutcome.status !== "fulfilled") return;

    expect(
      serviceOutcome.report.companyShortlist.filter(
        (item) => item.domain === "shared-serviceflow-domain.com"
      )
    ).toHaveLength(1);
    expect(
      serviceOutcome.report.drafts.filter((draft) =>
        draft.body.includes("shared-serviceflow-domain.com")
      )
    ).toHaveLength(1);
    expect(serviceOutcome.report.metrics.deduplicatedCompanies).toBe(1);
  });
});

function input(
  source: MarketScoutSource,
  overrides: Partial<MarketScoutCoordinatorInput> = {}
): MarketScoutCoordinatorInput {
  return {
    actor: operator,
    batchKey: "market-scout-unit",
    source,
    repository: new InMemoryGrowthRepository(),
    concurrency: 4,
    ...overrides
  };
}

function discoveryFor(task: MarketScoutTask): Record<string, unknown> {
  return {
    sourceUrlsReviewed: 1,
    paidSpend: 0,
    candidates: [
      {
        candidate: publicCandidate(task),
        publicText: publicText(task)
      }
    ]
  };
}

function publicCandidate(task: MarketScoutTask): Record<string, unknown> {
  const market = marketProfiles[task.marketKey];
  return {
    laneKey: task.laneKey,
    marketKey: task.marketKey,
    companyName: "Public Organization " + task.laneKey + " " + task.marketKey,
    domain: task.laneKey + "-" + task.marketKey + ".com",
    country: market.geography.countryCode,
    sourceUrl:
      "https://" + task.laneKey + "-" + task.marketKey + ".com/services",
    sourceKind: "PUBLIC_COMPANY_WEBSITE",
    synthetic: false,
    signalKeys: growthManifests[task.laneKey].scoring.signals.map(
      (signal) => signal.key
    ),
    marketSignalKeys: ["documented_icp_density", "documented_pain"],
    riskFlags: []
  };
}

function publicText(task: MarketScoutTask): string {
  if (task.marketKey === "fr-france") {
    return "Services professionnels pour les entreprises et les equipes locales.";
  }
  if (task.marketKey === "ae-dubai" || task.marketKey === "iq-kri-erbil") {
    return "خدمات مهنية للشركات المحلية وإدارة فرق العمل.";
  }
  return "Professional services for local companies and their teams.";
}
