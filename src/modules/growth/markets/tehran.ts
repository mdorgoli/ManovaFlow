import type { MarketProfile } from "./types";
import { marketCriteria } from "./types";

// Configuration for a user-requested public-data sample, not legal evidence.
export const tehranMarket = Object.freeze({
  key: "ir-tehran",
  displayName: "تهران / نمونه پژوهشی ایران",
  syntheticDemo: true,
  researchOnly: true,
  geography: {
    countryCode: "IR",
    region: "Tehran",
    city: "Tehran",
    representsWholeCountry: false
  },
  locales: ["fa-IR", "en"],
  allowedSourceKinds: ["OPEN_DATASET", "PUBLIC_COMPANY_WEBSITE"],
  truthfulKycRequired: true,
  incorporationRecommendation: "NONE",
  companyPaymentLocationHypothesis: false,
  hypothesisStatus: "NOT_CANDIDATE",
  gates: {
    dataMarketing: "UNKNOWN",
    contract: "UNKNOWN",
    payment: "UNKNOWN",
    sanctionsKyc: "UNKNOWN"
  },
  requiredGateLabels: [
    "IR_RESEARCH_SAMPLE_ONLY",
    "DATA_MARKETING_REVIEW",
    "CONTRACT_REVIEW",
    "PAYMENT_REVIEW",
    "SANCTIONS_KYC"
  ],
  explicitUnknowns: [
    "Public-data coverage in this Tehran sample; not the whole Iranian market",
    "Persian product and customer-communication readiness beyond deterministic research parsing",
    "Applicable data and marketing rules for the intended channel",
    "Contract, payment, provider eligibility and truthful sanctions/KYC review",
    "Actual workflow pain, buyer authority, willingness to trial or pay"
  ],
  scoring: { criteria: marketCriteria },
  readinessSignalKeys: [],
  officialReferences: []
} satisfies MarketProfile);
