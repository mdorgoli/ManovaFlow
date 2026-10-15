import type { MarketProfile } from "./types";
import { marketCriteria } from "./types";

export const erbilKriMarket = Object.freeze({
  key: "iq-kri-erbil",
  displayName: "اربیل / اقلیم کردستان عراق",
  syntheticDemo: true,
  researchOnly: true,
  geography: {
    countryCode: "IQ",
    region: "Kurdistan Region of Iraq",
    city: "Erbil",
    representsWholeCountry: false
  },
  locales: ["ku", "ar-IQ", "en"],
  allowedSourceKinds: [
    "OFFICIAL_REGISTRY",
    "PUBLIC_COMPANY_WEBSITE",
    "OFFICIAL_ASSOCIATION",
    "OFFICIAL_PROCUREMENT",
    "OPEN_DATASET",
    "WARM_REFERRAL"
  ],
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
    "KRI_SCOPE",
    "IRAQ_FEDERAL_SCOPE",
    "CROSS_BORDER_CONTRACT",
    "PAYMENT",
    "DATA",
    "SANCTIONS_KYC"
  ],
  explicitUnknowns: [
    "KRI-specific and Iraqi federal legal allocation",
    "Cross-border contract enforceability",
    "Payment collection to a French company",
    "Data and marketing rules for the exact channel",
    "Sanctions and truthful KYC acceptance"
  ],
  scoring: { criteria: marketCriteria },
  readinessSignalKeys: [
    "documented_icp_density",
    "documented_pain",
    "language_operability"
  ],
  officialReferences: [
    {
      category: "OUTREACH",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://www.sjc.iq/view-en.80243/",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary: "No scoped marketing-channel rule was established for Erbil/KRI."
    },
    {
      category: "DATA",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://www.sjc.iq/view-en.80243/",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary:
        "Absence of captured comprehensive law is not permission; KRI scope needs counsel."
    },
    {
      category: "AI_DISCLOSURE",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://www.sjc.iq/view-en.80243/",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary:
        "AI disclosure rules are not established for the actual use case."
    },
    {
      category: "CONTRACT",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://tasjeel.mot.gov.iq/sh2/",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary:
        "A registry exists; it does not prove cross-border SaaS enforceability in KRI."
    },
    {
      category: "PAYMENT",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://tasjeel.mot.gov.iq/sh2/",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary: "No compliant payment route has been verified."
    },
    {
      category: "SANCTIONS_KYC",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://tasjeel.mot.gov.iq/sh2/",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary: "Owner, bank and provider-specific KYC require truthful review."
    }
  ]
} satisfies MarketProfile);
