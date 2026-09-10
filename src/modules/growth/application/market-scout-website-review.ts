import type { LaneKey } from "../domain/types";

export const WEBSITE_REVIEW_FACTS = [
  "PUBLIC_SERVICE_DESCRIPTION",
  "PUBLIC_BOOKING_PATH",
  "PUBLIC_HOURS",
  "PUBLIC_MULTI_LOCATION",
  "PUBLIC_BRIEF_PATH",
  "PUBLIC_APPROVAL_LANGUAGE",
  "PUBLIC_PACKAGED_SERVICE_LANGUAGE"
] as const;

export type WebsiteReviewFact = (typeof WEBSITE_REVIEW_FACTS)[number];

export interface WebsiteReviewBudget {
  maxRequests: number;
  maxElapsedMs: number;
  maxResponseBytes: number;
}

export interface WebsiteReviewRequest {
  sourceUrl: string;
  laneKey: LaneKey;
  countryCode: string;
  budget: WebsiteReviewBudget;
  signal?: AbortSignal;
}

export interface WebsiteReviewResult {
  sourceUrl: string;
  finalUrl: string | null;
  outcome: "SUCCEEDED" | "REJECTED" | "FAILED" | "SKIPPED";
  reason: string;
  errorCode: string | null;
  requestsMade: number;
  bytesRead: number;
  contentHandling: "UNTRUSTED_DATA_ONLY";
  untrustedInstructionTextDetected: boolean;
  documentedFacts: WebsiteReviewFact[];
  potentialFitReason: string;
  unknowns: string[];
}

export interface MarketScoutWebsiteReviewer {
  review(request: WebsiteReviewRequest): Promise<WebsiteReviewResult>;
}
