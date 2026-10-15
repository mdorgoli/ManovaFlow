import { describe, expect, it, vi } from "vitest";
import { OverpassMarketScoutSource } from "@/modules/growth/infrastructure/overpass-market-scout-source";

describe("Overpass Market Scout source", () => {
  it("discovers and deduplicates public organizations from country and vertical only", async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) => {
        void _input;
        void _init;
        return new Response(
          JSON.stringify({
            version: 0.6,
            generator: "Overpass API",
            elements: [
              {
                type: "candidate",
                id: 534911895,
                tags: {
                  osm_type: "node",
                  name: "Tchip",
                  category: "hairdresser",
                  website: "https://tchip.fr/salon/view/4098",
                  opening_hours: "Mo-Sa 09:00-19:00"
                }
              },
              {
                type: "candidate",
                id: 42,
                tags: {
                  osm_type: "way",
                  name: "Tchip duplicate",
                  category: "hairdresser",
                  website: "https://www.tchip.fr/another",
                  opening_hours: ""
                }
              },
              {
                type: "candidate",
                id: 43,
                tags: {
                  osm_type: "node",
                  name: "Unsafe listing",
                  category: "beauty",
                  website: "http://127.0.0.1/private"
                }
              }
            ]
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
    );
    const source = new OverpassMarketScoutSource({ fetchImpl });

    const result = await source.discover({
      task: { laneKey: "beautyflow", marketKey: "fr-france" },
      budget: { maxSourceUrls: 1, maxOrganizations: 3, maxElapsedMs: 5_000 },
      signal: new AbortController().signal
    });

    expect(result).toEqual({
      sourceUrlsReviewed: 1,
      paidSpend: 0,
      candidates: [
        {
          candidate: {
            laneKey: "beautyflow",
            marketKey: "fr-france",
            companyName: "Tchip",
            domain: "tchip.fr",
            country: "FR",
            sourceUrl: "https://www.openstreetmap.org/node/534911895",
            reportedPublicWebsiteUrl: "https://tchip.fr/salon/view/4098",
            sourceKind: "OPEN_DATASET",
            synthetic: false,
            signalKeys: [
              "non_medical_beauty",
              "catalog_hours_visible",
              "supported_public_language",
              "country_research_ready"
            ],
            marketSignalKeys: [],
            riskFlags: []
          },
          publicText: "Tchip hairdresser"
        }
      ]
    });

    const [endpoint, init] = fetchImpl.mock.calls[0] ?? [];
    expect(endpoint).toBe("https://overpass-api.de/api/interpreter");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "ManovaFlow-MarketScout/0.1"
      }
    });
    const body = String(init?.body);
    expect(body).toContain("48.8476%2C2.3385%2C48.8656%2C2.3663");
    expect(body).toContain("hairdresser");
    expect(body).not.toContain("Tchip");
    const query = new URLSearchParams(body).get("data") ?? "";
    expect(query).toContain("convert candidate");
    expect(query).not.toContain("phone");
    expect(query).not.toContain("email");
  });

  it("fails closed on an oversized or non-JSON upstream response", async () => {
    const oversized = new OverpassMarketScoutSource({
      fetchImpl: vi.fn(
        async () =>
          new Response("x", {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": "600000"
            }
          })
      )
    });
    await expect(oversized.discover(request())).rejects.toThrow(
      "OVERPASS_RESPONSE_TOO_LARGE"
    );

    const html = new OverpassMarketScoutSource({
      fetchImpl: vi.fn(
        async () =>
          new Response("<html>busy</html>", {
            status: 200,
            headers: { "content-type": "text/html" }
          })
      )
    });
    await expect(html.discover(request())).rejects.toThrow(
      "OVERPASS_RESPONSE_CONTENT_TYPE_INVALID"
    );
  });
});

function request() {
  return {
    task: { laneKey: "serviceflow", marketKey: "fr-france" } as const,
    budget: { maxSourceUrls: 1, maxOrganizations: 3, maxElapsedMs: 5_000 },
    signal: new AbortController().signal
  };
}
