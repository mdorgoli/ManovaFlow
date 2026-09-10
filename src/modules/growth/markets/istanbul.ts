import type { MarketProfile } from "./types";
import { marketCriteria } from "./types";

export const istanbulMarket = Object.freeze({
  key: "tr-istanbul",
  displayName: "استانبول / ترکیه",
  syntheticDemo: true,
  researchOnly: true,
  geography: { countryCode: "TR", region: "Istanbul", city: "Istanbul", representsWholeCountry: false },
  locales: ["tr-TR", "en"],
  allowedSourceKinds: ["OFFICIAL_REGISTRY", "PUBLIC_COMPANY_WEBSITE", "OFFICIAL_ASSOCIATION", "OFFICIAL_PROCUREMENT", "OPEN_DATASET", "WARM_REFERRAL"],
  truthfulKycRequired: true,
  incorporationRecommendation: "NONE",
  companyPaymentLocationHypothesis: false,
  hypothesisStatus: "NOT_CANDIDATE",
  gates: { dataMarketing: "UNKNOWN", contract: "UNKNOWN", payment: "UNKNOWN", sanctionsKyc: "UNKNOWN" },
  requiredGateLabels: ["KVKK", "IYS", "CROSS_BORDER_PAYMENT", "CURRENCY_VOLATILITY"],
  explicitUnknowns: [
    "KVKK and possible VERBIS scope for the actual controller relationship",
    "IYS and channel consent for any future communication",
    "Cross-border contract and payment to a French company",
    "Currency-volatility allocation"
  ],
  scoring: { criteria: marketCriteria },
  readinessSignalKeys: ["documented_size_growth", "documented_icp_density", "documented_pain", "language_operability", "competition_gap"],
  officialReferences: [
    { category: "OUTREACH", classification: "FACT", publisherType: "OFFICIAL", sourceUrl: "https://ticaret.gov.tr/ic-ticaret/ticari-elektronik-iletiler/ileti-yonetim-sistemi-iys", checkedAt: "2026-09-03T00:00:00.000Z", summary: "IYS is a separate future channel gate; Phase 1 performs no outreach." },
    { category: "DATA", classification: "FACT", publisherType: "OFFICIAL", sourceUrl: "https://www.kvkk.gov.tr/Icerik/6649/Personal-Data-Protection-Law", checkedAt: "2026-09-03T00:00:00.000Z", summary: "KVKK official text captured; role and transfer scope remain case-specific." },
    { category: "AI_DISCLOSURE", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://ticaret.gov.tr/ic-ticaret/mevzuat/elektronik-ticaret", checkedAt: "2026-09-03T00:00:00.000Z", summary: "AI disclosure duties for a future concrete flow are not established." },
    { category: "CONTRACT", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://www.kvkk.gov.tr/Icerik/6635/By-Law-On-Data-Controllers-Registry", checkedAt: "2026-09-03T00:00:00.000Z", summary: "Cross-border SaaS contract route needs local legal review." },
    { category: "PAYMENT", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://www.tcmb.gov.tr/", checkedAt: "2026-09-03T00:00:00.000Z", summary: "Payment rail and currency allocation are not verified." },
    { category: "SANCTIONS_KYC", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://www.tcmb.gov.tr/", checkedAt: "2026-09-03T00:00:00.000Z", summary: "Provider-specific truthful KYC has not been tested." }
  ]
} satisfies MarketProfile);
