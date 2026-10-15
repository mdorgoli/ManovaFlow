import type { ComplianceEvidence } from "../../compliance/domain/gate";
import type { MarketKey } from "../domain/types";
import type { MarketScoringProfile } from "../domain/market-scoring";

export type ReadinessState = "RESEARCH_BOUNDED" | "UNKNOWN";

export interface MarketProfile {
  key: MarketKey;
  displayName: string;
  syntheticDemo: true;
  researchOnly: true;
  geography: {
    countryCode: string;
    region: string | null;
    city: string | null;
    representsWholeCountry: boolean;
  };
  locales: readonly string[];
  allowedSourceKinds: readonly string[];
  truthfulKycRequired: true;
  incorporationRecommendation: "NONE";
  companyPaymentLocationHypothesis: boolean;
  hypothesisStatus: "UNVERIFIED" | "NOT_CANDIDATE";
  gates: {
    dataMarketing: ReadinessState;
    contract: ReadinessState;
    payment: ReadinessState;
    sanctionsKyc: ReadinessState;
  };
  requiredGateLabels: readonly string[];
  explicitUnknowns: readonly string[];
  scoring: MarketScoringProfile;
  readinessSignalKeys: readonly string[];
  officialReferences: readonly ComplianceEvidence[];
}

export const marketCriteria = Object.freeze([
  { key: "documented_size_growth", label: "اندازه یا رشد مستند", weight: 12 },
  { key: "documented_icp_density", label: "تراکم مستند ICP", weight: 14 },
  { key: "documented_pain", label: "درد قابل مشاهده", weight: 12 },
  { key: "language_operability", label: "قابلیت زبانی", weight: 8 },
  { key: "ability_to_pay", label: "توان پرداخت", weight: 10 },
  { key: "competition_gap", label: "شکاف رقابتی", weight: 10 },
  {
    key: "contract_from_france",
    label: "امکان قرارداد با شرکت فرانسوی",
    weight: 12
  },
  {
    key: "payment_to_france",
    label: "امکان پرداخت به شرکت فرانسوی",
    weight: 10
  },
  {
    key: "data_marketing_readiness",
    label: "آمادگی داده و بازاریابی",
    weight: 7
  },
  { key: "bounded_acquisition", label: "هزینه جذب محدودپذیر", weight: 5 }
] as const);
