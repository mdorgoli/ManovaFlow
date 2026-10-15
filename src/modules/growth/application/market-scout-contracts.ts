import type { CandidateInput } from "../domain/candidate-schema";
import type { LaneKey, MarketKey } from "../domain/types";

export const PUBLIC_MARKET_SCOUT_SOURCE_KINDS = [
  "OFFICIAL_REGISTRY",
  "PUBLIC_COMPANY_WEBSITE",
  "OFFICIAL_ASSOCIATION",
  "OFFICIAL_PROCUREMENT",
  "OPEN_DATASET"
] as const satisfies readonly CandidateInput["sourceKind"][];

export type MarketScoutLanguage = "en" | "fr" | "ar";
// Source language is independent of the three supported dashboard locales.
export type MarketScoutResearchLanguage = MarketScoutLanguage | "fa";
export type MarketScoutDirection = "LTR" | "RTL";
export type MarketScoutLanguageBasis =
  "PUBLIC_TEXT" | "MARKET_LOCALE_FALLBACK" | "DEFAULT_ENGLISH";

export interface MarketScoutTask {
  laneKey: LaneKey;
  marketKey: MarketKey;
}

export interface MarketScoutBudget {
  maxSourceUrls: number;
  maxOrganizations: number;
  maxElapsedMs: number;
}

export interface MarketScoutDiscoveryRequest {
  task: MarketScoutTask;
  budget: MarketScoutBudget;
  signal: AbortSignal;
}

export interface MarketScoutSource {
  discover(request: MarketScoutDiscoveryRequest): Promise<unknown>;
}

export interface AcceptedMarketScoutCandidate {
  candidate: CandidateInput;
  language: MarketScoutResearchLanguage;
  direction: MarketScoutDirection;
  languageBasis: MarketScoutLanguageBasis;
}

export type MarketScoutLanguageMetadata = Pick<
  AcceptedMarketScoutCandidate,
  "language" | "direction" | "languageBasis"
>;

export const MARKET_SCOUT_REJECTION_CODES = [
  "INVALID_CANDIDATE",
  "NON_PUBLIC_SOURCE_KIND",
  "SOURCE_KIND_NOT_ALLOWLISTED",
  "TASK_SCOPE_MISMATCH",
  "SYNTHETIC_RECORD_FORBIDDEN"
] as const;

export type MarketScoutRejectionCode =
  (typeof MARKET_SCOUT_REJECTION_CODES)[number];

export type MarketScoutRejectionCounts = Record<
  MarketScoutRejectionCode,
  number
>;
