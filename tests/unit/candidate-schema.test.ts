import { describe, expect, it } from "vitest";
import { parseCandidate } from "@/modules/growth/domain/candidate-schema";

const syntheticCandidate = {
  laneKey: "serviceflow",
  marketKey: "fr-france",
  companyName: "Atelier Nord — DEMO FICTIONAL",
  domain: "atelier-nord.example",
  country: "FR",
  sourceUrl: "https://atelier-nord.example/services",
  sourceKind: "SYNTHETIC",
  synthetic: true,
  signalKeys: ["non_emergency_maintenance"],
  marketSignalKeys: ["documented_icp_density"],
  riskFlags: []
} as const;

describe("parseCandidate", () => {
  it("accepts a clearly labelled synthetic company on a reserved example domain", () => {
    const candidate = parseCandidate(syntheticCandidate);

    expect(candidate.synthetic).toBe(true);
    expect(candidate.domain).toBe("atelier-nord.example");
  });

  it("rejects personal contact fields instead of silently stripping them", () => {
    expect(() =>
      parseCandidate({
        ...syntheticCandidate,
        contactEmail: "person@atelier-nord.example"
      })
    ).toThrow(/Unrecognized key|contactEmail/i);
  });

  it.each([
    "http://127.0.0.1/internal",
    "https://localhost/company",
    "https://user:secret@example.com/company",
    "ftp://example.com/company"
  ])("rejects unsafe evidence URL %s", (sourceUrl) => {
    expect(() =>
      parseCandidate({
        ...syntheticCandidate,
        sourceUrl,
        synthetic: false,
        sourceKind: "PUBLIC_COMPANY_WEBSITE"
      })
    ).toThrow();
  });

  it("rejects a private OSM-reported website URL", () => {
    expect(() =>
      parseCandidate({
        ...syntheticCandidate,
        domain: "public-company.fr",
        sourceUrl: "https://www.openstreetmap.org/node/123",
        reportedPublicWebsiteUrl: "https://127.0.0.1/internal",
        synthetic: false,
        sourceKind: "OPEN_DATASET"
      })
    ).toThrow(/Private and local/i);
  });

  it("requires synthetic records to use a reserved example domain", () => {
    expect(() =>
      parseCandidate({
        ...syntheticCandidate,
        domain: "real-company.fr",
        sourceUrl: "https://real-company.fr/services"
      })
    ).toThrow(/example/i);
  });
});
