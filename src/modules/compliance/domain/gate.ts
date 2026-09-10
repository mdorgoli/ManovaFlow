export const REQUIRED_COMPLIANCE_CATEGORIES = [
  "OUTREACH",
  "DATA",
  "AI_DISCLOSURE",
  "CONTRACT",
  "PAYMENT",
  "SANCTIONS_KYC"
] as const;

export type ComplianceCategory =
  (typeof REQUIRED_COMPLIANCE_CATEGORIES)[number];
export type EvidenceClassification = "FACT" | "INFERENCE" | "UNKNOWN";

export interface ComplianceEvidence {
  category: ComplianceCategory;
  classification: EvidenceClassification;
  publisherType: "OFFICIAL" | "OTHER";
  sourceUrl: string;
  checkedAt: string;
  summary: string;
}

export interface ComplianceGateInput {
  marketKey: string;
  targetStage: "RESEARCH_ONLY" | "HUMAN_SEND";
  evidence: readonly ComplianceEvidence[];
  humanLegalReview: boolean;
}

export interface ComplianceDecision {
  status:
    | "RESEARCH_ONLY_ALLOWED"
    | "HUMAN_SEND_BLOCKED"
    | "HUMAN_REVIEW_REQUIRED"
    | "RECORDED_DECISION_REQUIRED";
  missingCategories: ComplianceCategory[];
  unknownCategories: ComplianceCategory[];
  facts: ComplianceEvidence[];
  inferences: ComplianceEvidence[];
  unknowns: ComplianceEvidence[];
  escalations: string[];
  checklist: string[];
  disclaimer: string;
  authorizationToken: null;
}

const FRESHNESS_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export function evaluateComplianceGate(
  input: ComplianceGateInput,
  now = new Date()
): ComplianceDecision {
  const facts = input.evidence.filter(
    (item) => item.classification === "FACT"
  );
  const inferences = input.evidence.filter(
    (item) => item.classification === "INFERENCE"
  );
  const unknowns = input.evidence.filter(
    (item) => item.classification === "UNKNOWN"
  );
  const unknownCategories = [
    ...new Set(unknowns.map((item) => item.category))
  ];

  const supported = new Set(
    facts
      .filter((item) => isFreshOfficialEvidence(item, now))
      .map((item) => item.category)
  );
  const missingCategories = REQUIRED_COMPLIANCE_CATEGORIES.filter(
    (category) => !supported.has(category)
  );

  const base = {
    missingCategories,
    unknownCategories,
    facts,
    inferences,
    unknowns,
    checklist: REQUIRED_COMPLIANCE_CATEGORIES.map(
      (category) =>
        category + ": official source, scope, date, and human owner"
    ),
    disclaimer:
      "این ابزار جایگزین وکیل نیست؛ فقط شواهد و دروازه سیاست را ثبت می‌کند.",
    authorizationToken: null
  } satisfies Omit<ComplianceDecision, "status" | "escalations">;

  if (input.targetStage === "RESEARCH_ONLY") {
    return {
      ...base,
      status: "RESEARCH_ONLY_ALLOWED",
      escalations: []
    };
  }

  if (missingCategories.length > 0 || unknownCategories.length > 0) {
    return {
      ...base,
      status: "HUMAN_SEND_BLOCKED",
      escalations: [
        ...missingCategories.map((category) => "MISSING_" + category),
        ...unknownCategories.map((category) => "UNKNOWN_" + category)
      ]
    };
  }

  if (!input.humanLegalReview) {
    return {
      ...base,
      status: "HUMAN_REVIEW_REQUIRED",
      escalations: ["AUTHORIZED_LEGAL_REVIEW"]
    };
  }

  return {
    ...base,
    status: "RECORDED_DECISION_REQUIRED",
    escalations: ["RECORDED_HUMAN_DECISION_TOKEN"]
  };
}

function isFreshOfficialEvidence(
  evidence: ComplianceEvidence,
  now: Date
): boolean {
  if (evidence.publisherType !== "OFFICIAL") {
    return false;
  }

  let url: URL;
  try {
    url = new URL(evidence.sourceUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return false;
  }

  const checkedAt = new Date(evidence.checkedAt);
  if (Number.isNaN(checkedAt.getTime()) || checkedAt > now) {
    return false;
  }

  return now.getTime() - checkedAt.getTime() <= FRESHNESS_WINDOW_MS;
}
