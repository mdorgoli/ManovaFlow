import { describe, expect, it } from "vitest";
import { runLiveMarketScoutPilot } from "@/modules/growth/application/live-market-scout-pilot";
import { runMarketScout } from "@/modules/growth/application/market-scout-coordinator";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";
import { OverpassMarketScoutSource } from "@/modules/growth/infrastructure/overpass-market-scout-source";
import { marketProfiles } from "@/modules/growth/markets";

const actor = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
} as const;

describe("Iran research pilot", () => {
  it("discovers in Tehran, persists the scoped candidate, and never awards unverified market readiness", async () => {
    let query = "";
    const source = new OverpassMarketScoutSource({
      fetchImpl: async (_url, init) => {
        query = new URLSearchParams(String(init?.body)).get("data") ?? "";
        return new Response(JSON.stringify({ elements: [{
          type: "candidate", id: 123,
          tags: { osm_type: "node", name: "تأسیسات نمونه تهران", category: "hvac", website: "https://maintenance.example.test" }
        }] }), { headers: { "content-type": "application/json" } });
      }
    });
    const repository = new InMemoryGrowthRepository();
    const result = await runLiveMarketScoutPilot({
      actor, batchKey: "iran-research-test", countryCode: "ir", laneKey: "serviceflow", source, repository
    });
    expect(query).toContain("35.68,51.36,35.75,51.45");
    expect(query).toContain('out tags 9;');
    expect(query).not.toContain("تأسیسات نمونه تهران");
    expect(query).not.toMatch(/email|phone/);
    expect(result).toMatchObject({
      scope: { countryCode: "IR", laneKey: "serviceflow" },
      marketKey: "ir-tehran", sourceStatus: "SUCCEEDED", humanSend: "BLOCKED",
      costs: { paidSpend: 0, apolloCredits: 0 },
      actions: { messagesSent: 0, formsSubmitted: 0, contactReveals: 0, outboundActions: 0 }
    });
    expect(result.sample).toMatch(/Tehran.*not representative of all Iran/);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      companyName: "تأسیسات نمونه تهران", fitScore: 25,
      discoveryScoreStatus: "BELOW_DISCOVERY_THRESHOLD",
      detectedLanguage: "fa", direction: "RTL"
    });
    const snapshot = await repository.getDashboard(actor);
    expect(snapshot.companies).toHaveLength(1);
    expect(snapshot.companies[0]).toMatchObject({ country: "IR", synthetic: false });
    expect(snapshot.drafts).toHaveLength(0);
    expect(snapshot.complianceDecisions.length).toBeGreaterThan(0);
    expect(snapshot.complianceDecisions.every(item => item.status === "HUMAN_SEND_BLOCKED" && item.authorizationToken === null)).toBe(true);
    expect(snapshot.marketScores.every(item => item.marketKey === "ir-tehran")).toBe(true);
    const market = Object.values(marketProfiles).find(item => item.geography.countryCode === "IR");
    expect(market?.geography.representsWholeCountry).toBe(false);
    expect(market?.officialReferences).toEqual([]);
    expect(market?.readinessSignalKeys).toEqual([]);
    expect(Object.values(market?.gates ?? {})).toEqual(["UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"]);
  });

  it("does not silently add Iran to an unscoped default discovery", async () => {
    const countries: string[] = [];
    await runMarketScout({
      actor, batchKey: "default-scope-stays-bounded", repository: new InMemoryGrowthRepository(),
      source: { async discover(request) {
        countries.push(request.task.marketKey);
        return { sourceUrlsReviewed: 0, paidSpend: 0, candidates: [] };
      } }
    });
    expect(countries).not.toContain("ir-tehran");
    expect(countries).toHaveLength(12);
  });

  it("keeps an eligible Persian research draft Persian and unsent", async () => {
    const result = await runMarketScout({
      actor, batchKey: "persian-internal-only", scope: { countryCode: "IR", laneKey: "serviceflow" },
      repository: new InMemoryGrowthRepository(),
      source: { async discover() {
        return { sourceUrlsReviewed: 1, paidSpend: 0, candidates: [{
          candidate: {
            laneKey: "serviceflow", marketKey: "ir-tehran", country: "IR",
            companyName: "تأسیسات نمونه تهران", domain: "maintenance.example.test",
            sourceUrl: "https://maintenance.example.test", sourceKind: "PUBLIC_COMPANY_WEBSITE", synthetic: false,
            signalKeys: ["non_emergency_maintenance", "team_size_visible", "service_area_visible", "recurring_request_flow"],
            marketSignalKeys: [], riskFlags: []
          }, publicText: "تعمیر پکیج و سرویس کولر"
        }] };
      } }
    });
    expect(result.internalDrafts).toHaveLength(1);
    expect(result.internalDrafts[0]).toMatchObject({ language: "fa", direction: "RTL", state: "INTERNAL_ONLY", outboundEnabled: false });
    expect(result.internalDrafts[0]?.subject).toContain("ارسال نشده");
    expect(result.internalDrafts[0]?.body).toContain("تأسیسات نمونه تهران");
    expect(result.humanSend).toBe("BLOCKED");
  });
});
