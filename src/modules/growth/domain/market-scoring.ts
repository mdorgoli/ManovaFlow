import type { ScoreExplanation, ScoringSignal } from "./scoring";

export interface MarketScoringProfile {
  criteria: readonly ScoringSignal[];
}

export interface MarketScore {
  total: number;
  explanation: ScoreExplanation[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
}

export function scoreMarket(
  profile: MarketScoringProfile,
  input: { signalKeys: readonly string[] }
): MarketScore {
  const weightTotal = profile.criteria.reduce(
    (sum, criterion) => sum + criterion.weight,
    0
  );
  if (weightTotal !== 100) {
    throw new Error(
      "Market scoring weights must equal 100; received " + weightTotal
    );
  }

  const allowed = new Set(profile.criteria.map((criterion) => criterion.key));
  const unknown = input.signalKeys.filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error("Unknown market signal: " + unknown.join(", "));
  }

  const matched = new Set(input.signalKeys);
  const explanation = profile.criteria.map((criterion) => ({
    key: criterion.key,
    label: criterion.label,
    matched: matched.has(criterion.key),
    awarded: matched.has(criterion.key) ? criterion.weight : 0
  }));
  const total = explanation.reduce((sum, item) => sum + item.awarded, 0);
  const evidenceCount = explanation.filter((item) => item.matched).length;
  const confidence =
    evidenceCount >= Math.ceil(explanation.length * 0.8)
      ? "HIGH"
      : evidenceCount >= Math.ceil(explanation.length * 0.5)
        ? "MEDIUM"
        : "LOW";

  return { total, explanation, confidence };
}
