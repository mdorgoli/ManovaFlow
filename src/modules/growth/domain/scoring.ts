export interface ScoringSignal {
  key: string;
  label: string;
  weight: number;
}

export interface ScoringManifest {
  threshold: number;
  signals: readonly ScoringSignal[];
  prohibitedRiskFlags: readonly string[];
}

export interface ScoreInput {
  signalKeys: readonly string[];
  riskFlags: readonly string[];
}

export interface ScoreExplanation {
  key: string;
  label: string;
  matched: boolean;
  awarded: number;
}

export interface CandidateScore {
  total: number;
  status: "ELIGIBLE" | "BELOW_THRESHOLD" | "KILLED";
  explanation: ScoreExplanation[];
  killReasons: string[];
}

export function scoreCandidate(
  manifest: ScoringManifest,
  input: ScoreInput
): CandidateScore {
  assertWeights(manifest.signals);
  const allowedKeys = new Set(manifest.signals.map((signal) => signal.key));
  const unknownSignals = input.signalKeys.filter(
    (key) => !allowedKeys.has(key)
  );
  if (unknownSignals.length > 0) {
    throw new Error("Unknown company signal: " + unknownSignals.join(", "));
  }

  const prohibited = new Set(manifest.prohibitedRiskFlags);
  const killReasons = [
    ...new Set(input.riskFlags.filter((flag) => prohibited.has(flag)))
  ];
  const matched = new Set(input.signalKeys);
  const explanation = manifest.signals.map((signal) => ({
    key: signal.key,
    label: signal.label,
    matched: matched.has(signal.key),
    awarded: matched.has(signal.key) ? signal.weight : 0
  }));

  if (killReasons.length > 0) {
    return {
      total: 0,
      status: "KILLED",
      explanation,
      killReasons
    };
  }

  const total = explanation.reduce((sum, item) => sum + item.awarded, 0);
  return {
    total,
    status: total >= manifest.threshold ? "ELIGIBLE" : "BELOW_THRESHOLD",
    explanation,
    killReasons: []
  };
}

function assertWeights(signals: readonly ScoringSignal[]): void {
  const total = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (total !== 100) {
    throw new Error("Scoring weights must equal 100; received " + total);
  }
}
