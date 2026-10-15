import { describe, expect, it } from "vitest";
import { runMarketScout } from "@/modules/growth/application/market-scout-coordinator";
import type {
  MarketScoutSource,
  MarketScoutTask
} from "@/modules/growth/application/market-scout-contracts";
import { growthManifests } from "@/modules/growth/manifests";
import { marketProfiles } from "@/modules/growth/markets";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

describe("Market Scout Research-Only vertical slice", () => {
  it("produces multilingual shortlists and internal-only drafts while Human-Send stays blocked", async () => {
    const repository = new InMemoryGrowthRepository();
    const source: MarketScoutSource = {
      async discover(request) {
        return {
          sourceUrlsReviewed: 1,
          paidSpend: 0,
          candidates: [
            {
              candidate: candidateFor(request.task),
              publicText: textFor(request.task)
            }
          ]
        };
      }
    };

    const result = await runMarketScout({
      actor: {
        tenantId: "10000000-0000-4000-8000-000000000001",
        actorId: "20000000-0000-4000-8000-000000000001",
        role: "OWNER"
      },
      batchKey: "market-scout-e2e",
      source,
      repository,
      concurrency: 4
    });

    expect(result.humanSend).toBe("BLOCKED");
    expect(result.aggregate).toMatchObject({
      workersCompleted: 12,
      workersFailed: 0,
      acceptedCandidates: 12,
      outboundActions: 0
    });
    expect(result.internalDrafts).toHaveLength(10);
    expect(
      result.internalDrafts.every(
        (draft) =>
          draft.state === "INTERNAL_ONLY" && draft.outboundEnabled === false
      )
    ).toBe(true);
    expect(
      result.internalDrafts
        .filter((draft) => draft.language === "ar")
        .every(
          (draft) =>
            draft.direction === "RTL" && draft.body.includes("لم يتم الإرسال")
        )
    ).toBe(true);
    expect(
      result.internalDrafts
        .filter((draft) => draft.language === "fr")
        .every(
          (draft) =>
            draft.direction === "LTR" && draft.body.includes("NON ENVOYÉ")
        )
    ).toBe(true);
    expect(
      result.internalDrafts
        .filter((draft) => draft.language === "en")
        .every(
          (draft) =>
            draft.direction === "LTR" && draft.body.includes("NOT SENT")
        )
    ).toBe(true);

    for (const outcome of Object.values(result.research.laneResults)) {
      expect(outcome.status).toBe("fulfilled");
      if (outcome.status !== "fulfilled") continue;
      expect(outcome.report.companyShortlist).toHaveLength(4);
      expect(
        outcome.report.companyShortlist.every(
          (company) =>
            company.language === "en" ||
            company.language === "fr" ||
            company.language === "ar"
        )
      ).toBe(true);
      expect(
        outcome.report.companyShortlist
          .filter((company) => company.language === "ar")
          .every((company) => company.direction === "RTL")
      ).toBe(true);
      expect(
        outcome.report.complianceDecisions.every(
          (decision) =>
            decision.status === "HUMAN_SEND_BLOCKED" &&
            decision.authorizationToken === null
        )
      ).toBe(true);
      expect(outcome.report.outboundActions).toBe(0);
    }

    const dashboard = await repository.getDashboard({
      tenantId: "10000000-0000-4000-8000-000000000001",
      actorId: "20000000-0000-4000-8000-000000000001",
      role: "OWNER"
    });
    expect(dashboard.runs).toHaveLength(3);
    expect(dashboard.companies).toHaveLength(12);
    expect(dashboard.drafts).toHaveLength(10);
    expect(
      dashboard.drafts.every((draft) => draft.outboundEnabled === false)
    ).toBe(true);
  });
});

function candidateFor(task: MarketScoutTask): Record<string, unknown> {
  const market = marketProfiles[task.marketKey];
  return {
    laneKey: task.laneKey,
    marketKey: task.marketKey,
    companyName: companyName(task),
    domain: task.laneKey + "-" + task.marketKey + ".org",
    country: market.geography.countryCode,
    sourceUrl:
      "https://" + task.laneKey + "-" + task.marketKey + ".org/services",
    sourceKind: "PUBLIC_COMPANY_WEBSITE",
    synthetic: false,
    signalKeys: growthManifests[task.laneKey].scoring.signals.map(
      (signal) => signal.key
    ),
    marketSignalKeys: ["documented_icp_density", "documented_pain"],
    riskFlags: []
  };
}

function companyName(task: MarketScoutTask): string {
  if (task.marketKey === "fr-france") return "Atelier Services Publics";
  if (task.marketKey === "ae-dubai" || task.marketKey === "iq-kri-erbil") {
    return "شركة الخدمات العامة";
  }
  return "Public Services Studio";
}

function textFor(task: MarketScoutTask): string {
  if (task.marketKey === "fr-france") {
    return "Services professionnels pour les entreprises et les equipes locales.";
  }
  if (task.marketKey === "ae-dubai" || task.marketKey === "iq-kri-erbil") {
    return "خدمات مهنية للشركات المحلية وإدارة فرق العمل.";
  }
  return "Professional services for local companies and their teams.";
}
