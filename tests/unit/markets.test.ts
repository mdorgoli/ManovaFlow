import { describe, expect, it } from "vitest";
import { MARKET_KEYS } from "@/modules/growth/domain/types";
import { marketProfiles } from "@/modules/growth/markets";

describe("global market profile registry", () => {
  it("contains the configured bounded research profiles", () => {
    expect(Object.keys(marketProfiles).sort()).toEqual([...MARKET_KEYS].sort());

    for (const profile of Object.values(marketProfiles)) {
      expect(profile.researchOnly).toBe(true);
      expect(profile.truthfulKycRequired).toBe(true);
      expect(profile.incorporationRecommendation).toBe("NONE");
      expect(
        profile.scoring.criteria.reduce((sum, item) => sum + item.weight, 0)
      ).toBe(100);
      expect(
        profile.officialReferences.every((item) => item.checkedAt.length > 0)
      ).toBe(true);
    }
  });

  it("keeps France as the only unverified company and payment hypothesis", () => {
    const candidates = Object.values(marketProfiles).filter(
      (profile) => profile.companyPaymentLocationHypothesis
    );

    expect(candidates.map((profile) => profile.key)).toEqual(["fr-france"]);
    expect(marketProfiles["fr-france"].hypothesisStatus).toBe("UNVERIFIED");
  });

  it("models Erbil as KRI scope rather than all Iraq and leaves readiness unknown", () => {
    const erbil = marketProfiles["iq-kri-erbil"];

    expect(erbil.geography).toMatchObject({
      countryCode: "IQ",
      region: "Kurdistan Region of Iraq",
      city: "Erbil",
      representsWholeCountry: false
    });
    expect(erbil.gates.contract).toBe("UNKNOWN");
    expect(erbil.gates.payment).toBe("UNKNOWN");
    expect(erbil.gates.dataMarketing).toBe("UNKNOWN");
    expect(erbil.explicitUnknowns.join(" ")).toMatch(
      /legal|contract|payment|data/i
    );
  });

  it("keeps Turkey policy and commercial gates separate", () => {
    const turkey = marketProfiles["tr-istanbul"];

    expect(turkey.requiredGateLabels).toEqual(
      expect.arrayContaining([
        "KVKK",
        "IYS",
        "CROSS_BORDER_PAYMENT",
        "CURRENCY_VOLATILITY"
      ])
    );
  });
});
