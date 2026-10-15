import { describe, expect, it } from "vitest";
import {
  scoreCandidate,
  type ScoringManifest
} from "@/modules/growth/domain/scoring";
import {
  scoreMarket,
  type MarketScoringProfile
} from "@/modules/growth/domain/market-scoring";

const companyManifest: ScoringManifest = {
  threshold: 65,
  signals: [
    { key: "vertical_match", label: "تطابق عمودی", weight: 40 },
    { key: "repeatable_flow", label: "گردش‌کار تکرارشونده", weight: 35 },
    { key: "public_language", label: "زبان عمومی", weight: 25 }
  ],
  prohibitedRiskFlags: ["personal_data"]
};

const marketProfile: MarketScoringProfile = {
  criteria: [
    { key: "documented_market", label: "بازار مستند", weight: 30 },
    { key: "documented_icp_density", label: "تراکم ICP", weight: 25 },
    { key: "contract_from_france", label: "قرارداد از فرانسه", weight: 25 },
    { key: "bounded_acquisition", label: "دستیابی محدود", weight: 20 }
  ]
};

describe("deterministic scoring", () => {
  it("computes company fit from literal manifest weights with an explanation", () => {
    const score = scoreCandidate(companyManifest, {
      signalKeys: ["vertical_match", "public_language"],
      riskFlags: []
    });

    expect(score.total).toBe(65);
    expect(score.status).toBe("ELIGIBLE");
    expect(score.explanation).toEqual([
      {
        key: "vertical_match",
        label: "تطابق عمودی",
        matched: true,
        awarded: 40
      },
      {
        key: "repeatable_flow",
        label: "گردش‌کار تکرارشونده",
        matched: false,
        awarded: 0
      },
      {
        key: "public_language",
        label: "زبان عمومی",
        matched: true,
        awarded: 25
      }
    ]);
  });

  it("kills company evaluation when a vertical risk flag is present", () => {
    const score = scoreCandidate(companyManifest, {
      signalKeys: ["vertical_match", "repeatable_flow", "public_language"],
      riskFlags: ["personal_data"]
    });

    expect(score.status).toBe("KILLED");
    expect(score.total).toBe(0);
    expect(score.killReasons).toEqual(["personal_data"]);
  });

  it("keeps market readiness separate from company fit", () => {
    const company = scoreCandidate(companyManifest, {
      signalKeys: ["vertical_match"],
      riskFlags: []
    });
    const market = scoreMarket(marketProfile, {
      signalKeys: ["documented_market", "contract_from_france"]
    });

    expect(company.total).toBe(40);
    expect(market.total).toBe(55);
    expect(market.explanation).toHaveLength(4);
  });
});
