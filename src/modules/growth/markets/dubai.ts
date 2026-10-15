import type { MarketProfile } from "./types";
import { marketCriteria } from "./types";

export const dubaiMarket = Object.freeze({
  key: "ae-dubai",
  displayName: "دبی / امارات",
  syntheticDemo: true,
  researchOnly: true,
  geography: {
    countryCode: "AE",
    region: "Dubai",
    city: "Dubai",
    representsWholeCountry: false
  },
  locales: ["ar-AE", "en"],
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
    "UAE_DATA",
    "TELEMARKETING_LICENSE",
    "DNCR",
    "CROSS_BORDER_CONTRACT",
    "PAYMENT_KYC"
  ],
  explicitUnknowns: [
    "Mainland versus free-zone data authority scope",
    "No outbound permission, local number, DNCR workflow or telemarketing licence",
    "Cross-border contract and payment to a French company",
    "Provider-specific truthful KYC acceptance"
  ],
  scoring: { criteria: marketCriteria },
  readinessSignalKeys: [
    "documented_size_growth",
    "documented_icp_density",
    "documented_pain",
    "language_operability",
    "competition_gap"
  ],
  officialReferences: [
    {
      category: "OUTREACH",
      classification: "FACT",
      publisherType: "OFFICIAL",
      sourceUrl:
        "https://www.moet.gov.ae/en/-/ministry-of-economy-and-telecommunications-and-digital-government-regulatory-authority-review-regulatory-legislations-in-organizing-operational-mechanisms-for-telemarketing-companies-in-the-uae-and-enhancing-consumer-protection-in-line-with-best-practices",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary:
        "Telemarketing controls are evidence for a future legal gate, not outreach permission."
    },
    {
      category: "DATA",
      classification: "FACT",
      publisherType: "OFFICIAL",
      sourceUrl:
        "https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary:
        "Federal and free-zone data paths require entity-specific review."
    },
    {
      category: "AI_DISCLOSURE",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl:
        "https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary: "AI disclosure duties are not established for the concrete flow."
    },
    {
      category: "CONTRACT",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl: "https://u.ae/en/information-and-services/business",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary: "No cross-border SaaS contract route has been approved."
    },
    {
      category: "PAYMENT",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl:
        "https://u.ae/en/information-and-services/finance-and-investment",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary:
        "Payment to a French company and currency handling remain unknown."
    },
    {
      category: "SANCTIONS_KYC",
      classification: "UNKNOWN",
      publisherType: "OFFICIAL",
      sourceUrl:
        "https://u.ae/en/information-and-services/finance-and-investment",
      checkedAt: "2026-09-03T00:00:00.000Z",
      summary: "No owner-specific KYC approval exists."
    }
  ]
} satisfies MarketProfile);
