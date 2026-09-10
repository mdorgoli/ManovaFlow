import type { MarketProfile } from "./types";
import { marketCriteria } from "./types";

export const franceMarket = Object.freeze({
  key: "fr-france",
  displayName: "فرانسه",
  syntheticDemo: true,
  researchOnly: true,
  geography: { countryCode: "FR", region: null, city: null, representsWholeCountry: true },
  locales: ["fr-FR", "en"],
  allowedSourceKinds: ["OFFICIAL_REGISTRY", "PUBLIC_COMPANY_WEBSITE", "OFFICIAL_ASSOCIATION", "OFFICIAL_PROCUREMENT", "OPEN_DATASET", "WARM_REFERRAL"],
  truthfulKycRequired: true,
  incorporationRecommendation: "NONE",
  companyPaymentLocationHypothesis: true,
  hypothesisStatus: "UNVERIFIED",
  gates: {
    dataMarketing: "RESEARCH_BOUNDED",
    contract: "UNKNOWN",
    payment: "UNKNOWN",
    sanctionsKyc: "UNKNOWN"
  },
  requiredGateLabels: ["GDPR", "CNIL_B2B", "FRENCH_ENTITY", "PAYMENT_KYC", "TAX"],
  explicitUnknowns: [
    "Final entity form and founder residence consequences",
    "Bank and payment-provider acceptance",
    "Tax, VAT, accounting, insurance and data-processing contracts"
  ],
  scoring: { criteria: marketCriteria },
  readinessSignalKeys: ["documented_size_growth", "documented_icp_density", "documented_pain", "language_operability", "competition_gap", "data_marketing_readiness", "bounded_acquisition"],
  officialReferences: [
    { category: "OUTREACH", classification: "FACT", publisherType: "OFFICIAL", sourceUrl: "https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique", checkedAt: "2026-09-03T00:00:00.000Z", summary: "CNIL B2B email guidance is evidence for scoped human review, not blanket permission." },
    { category: "DATA", classification: "FACT", publisherType: "OFFICIAL", sourceUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj", checkedAt: "2026-09-03T00:00:00.000Z", summary: "GDPR official text captured; applicability must be reviewed per processing purpose." },
    { category: "AI_DISCLOSURE", classification: "INFERENCE", publisherType: "OFFICIAL", sourceUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj", checkedAt: "2026-09-03T00:00:00.000Z", summary: "AI transparency scope remains a human legal interpretation for the actual flow." },
    { category: "CONTRACT", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://www.inpi.fr/synthese-des-formes-juridiques-de-lentreprise", checkedAt: "2026-09-03T00:00:00.000Z", summary: "INPI describes forms; it does not resolve the founder-specific contract route." },
    { category: "PAYMENT", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://www.inpi.fr/realiser-demarches/formalites-dentreprises/creer-sa-societe-par-actions-simplifiee-unipersonnelle-sasu", checkedAt: "2026-09-03T00:00:00.000Z", summary: "No bank or payment-provider acceptance has been established." },
    { category: "SANCTIONS_KYC", classification: "UNKNOWN", publisherType: "OFFICIAL", sourceUrl: "https://finance.ec.europa.eu/eu-and-world/sanctions-restrictive-measures/overview-sanctions-and-related-tools_en", checkedAt: "2026-09-03T00:00:00.000Z", summary: "Owner-specific sanctions and KYC eligibility require truthful provider review." }
  ]
} satisfies MarketProfile);
