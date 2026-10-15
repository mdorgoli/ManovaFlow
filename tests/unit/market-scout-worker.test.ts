import { describe, expect, it } from "vitest";
import {
  runMarketScoutWorker,
  type MarketScoutWorkerInput
} from "@/modules/growth/application/market-scout-worker";
import type {
  MarketScoutDiscoveryRequest,
  MarketScoutSource
} from "@/modules/growth/application/market-scout-contracts";
import { growthManifests } from "@/modules/growth/manifests";
import { marketProfiles } from "@/modules/growth/markets";

describe("Market Scout worker", () => {
  it("accepts a public organization candidate inside its exact task scope", async () => {
    const candidate = publicCandidate();
    const result = await runMarketScoutWorker(
      workerInput(
        sourceReturning({
          sourceUrlsReviewed: 1,
          paidSpend: 0,
          candidates: [
            {
              candidate,
              publicText:
                "Services professionnels pour les entreprises et les equipes locales."
            }
          ]
        })
      )
    );

    expect(result).toEqual({
      task: { laneKey: "serviceflow", marketKey: "fr-france" },
      budget: { maxSourceUrls: 2, maxOrganizations: 2, maxElapsedMs: 5_000 },
      sourceUrlsReviewed: 1,
      organizationsReturned: 1,
      acceptedCandidates: [
        {
          candidate,
          language: "fr",
          direction: "LTR",
          languageBasis: "PUBLIC_TEXT"
        }
      ],
      rejectionCounts: {
        INVALID_CANDIDATE: 0,
        NON_PUBLIC_SOURCE_KIND: 0,
        SOURCE_KIND_NOT_ALLOWLISTED: 0,
        TASK_SCOPE_MISMATCH: 0,
        SYNTHETIC_RECORD_FORBIDDEN: 0
      }
    });
  });

  it("drops malformed, synthetic, referral, non-allowlisted and task-mismatched records without persisting raw input", async () => {
    const valid = publicCandidate();
    const source = sourceReturning({
      sourceUrlsReviewed: 2,
      paidSpend: 0,
      candidates: [
        scoutRecord(valid),
        scoutRecord({ ...valid, sourceKind: "WARM_REFERRAL" }),
        scoutRecord({
          ...valid,
          synthetic: true,
          sourceKind: "SYNTHETIC",
          domain: "synthetic.example",
          sourceUrl: "https://synthetic.example/about"
        }),
        scoutRecord({ ...valid, marketKey: "ae-dubai", country: "AE" }),
        scoutRecord({ ...valid, email: "person@scout-worker.example" })
      ]
    });
    const result = await runMarketScoutWorker(
      workerInput(source, {
        maxSourceUrls: 2,
        maxOrganizations: 5,
        maxElapsedMs: 5_000
      })
    );

    expect(result.acceptedCandidates).toEqual([
      {
        candidate: valid,
        language: "en",
        direction: "LTR",
        languageBasis: "PUBLIC_TEXT"
      }
    ]);
    expect(result.rejectionCounts).toEqual({
      INVALID_CANDIDATE: 1,
      NON_PUBLIC_SOURCE_KIND: 1,
      SOURCE_KIND_NOT_ALLOWLISTED: 0,
      TASK_SCOPE_MISMATCH: 1,
      SYNTHETIC_RECORD_FORBIDDEN: 1
    });
    expect(JSON.stringify(result)).not.toContain("person@scout-worker.example");
  });

  it("fails the task closed when the source envelope exceeds its assigned budget", async () => {
    const source = sourceReturning({
      sourceUrlsReviewed: 3,
      paidSpend: 0,
      candidates: [scoutRecord(publicCandidate())]
    });

    await expect(runMarketScoutWorker(workerInput(source))).rejects.toThrow(
      "MARKET_SCOUT_SOURCE_BUDGET_EXCEEDED"
    );
  });

  it("rejects a public source kind that the assigned market did not allowlist", async () => {
    const candidate = {
      ...publicCandidate(),
      sourceKind: "OFFICIAL_PROCUREMENT"
    };
    const result = await runMarketScoutWorker({
      ...workerInput(
        sourceReturning({
          sourceUrlsReviewed: 1,
          paidSpend: 0,
          candidates: [scoutRecord(candidate)]
        })
      ),
      market: {
        ...marketProfiles["fr-france"],
        allowedSourceKinds: ["PUBLIC_COMPANY_WEBSITE"]
      }
    });

    expect(result.acceptedCandidates).toHaveLength(0);
    expect(result.rejectionCounts.SOURCE_KIND_NOT_ALLOWLISTED).toBe(1);
  });

  it("fails the task closed when the source reports paid spend or a malformed envelope", async () => {
    await expect(
      runMarketScoutWorker(
        workerInput(
          sourceReturning({
            sourceUrlsReviewed: 1,
            paidSpend: 1,
            candidates: [scoutRecord(publicCandidate())]
          })
        )
      )
    ).rejects.toThrow("MARKET_SCOUT_SOURCE_ENVELOPE_INVALID");

    await expect(
      runMarketScoutWorker(workerInput(sourceReturning({ candidates: [] })))
    ).rejects.toThrow("MARKET_SCOUT_SOURCE_ENVELOPE_INVALID");
  });
});

function workerInput(
  source: MarketScoutSource,
  budget = { maxSourceUrls: 2, maxOrganizations: 2, maxElapsedMs: 5_000 }
): MarketScoutWorkerInput {
  return {
    source,
    task: { laneKey: "serviceflow", marketKey: "fr-france" },
    manifest: growthManifests.serviceflow,
    market: marketProfiles["fr-france"],
    budget
  };
}

function sourceReturning(value: unknown): MarketScoutSource {
  return {
    async discover(_request: MarketScoutDiscoveryRequest): Promise<unknown> {
      void _request;
      return value;
    }
  };
}

function scoutRecord(
  candidate: Record<string, unknown>
): Record<string, unknown> {
  return {
    candidate,
    publicText: "Professional services for local companies and their teams."
  };
}

function publicCandidate(): Record<string, unknown> {
  return {
    laneKey: "serviceflow",
    marketKey: "fr-france",
    companyName: "Atelier Public Services",
    domain: "atelier-public-services.fr",
    country: "FR",
    sourceUrl: "https://atelier-public-services.fr/services",
    sourceKind: "PUBLIC_COMPANY_WEBSITE",
    synthetic: false,
    signalKeys: [
      "non_emergency_maintenance",
      "team_size_visible",
      "service_area_visible",
      "recurring_request_flow",
      "visible_intake_gap",
      "supported_public_language",
      "country_research_ready"
    ],
    marketSignalKeys: ["documented_icp_density", "documented_pain"],
    riskFlags: []
  };
}
