import { describe, expect, it } from "vitest";
import { parseMarketScoutReviewEvidence } from "@/modules/growth/application/market-scout-review-evidence";

describe("Market Scout website-review evidence contract", () => {
  it("rejects an overlong source URL", () => {
    const evidence = validEvidence();
    evidence.reviews[0]!.sourceUrl = `https://example.com/${"a".repeat(2_100)}`;

    expect(() => parseMarketScoutReviewEvidence(evidence)).toThrow();
  });

  it("rejects an ISO-compatible but non-canonical timestamp", () => {
    const evidence = validEvidence();
    evidence.reviews[0]!.occurredAt = "2026-09-05T10:00:01Z";

    expect(() => parseMarketScoutReviewEvidence(evidence)).toThrow();
  });

  it("rejects positive facts and potential fit for a non-successful review", () => {
    const evidence = validEvidence();
    evidence.reviews[0]!.outcome = "FAILED";

    expect(() => parseMarketScoutReviewEvidence(evidence)).toThrow();
  });
});

function validEvidence() {
  return {
    contractVersion: "manovaflow.market-scout.website-review-evidence.v1",
    runId: "bounded-contract-test",
    reviews: [{
      sourceUrl: "https://example.com",
      occurredAt: "2026-09-05T10:00:01.000Z",
      outcome: "SUCCEEDED",
      observedFacts: ["PUBLIC_SERVICE_DESCRIPTION"],
      potentialFit: "HUMAN_REVIEW_REQUIRED",
      unknowns: ["CUSTOMER_INTEREST_UNVERIFIED"],
      requestsMade: 2,
      bytesRead: 512,
      instructionLikeTextDetected: false
    }],
    safety: {
      paidSpend: 0,
      apolloCredits: 0,
      messagesSent: 0,
      formsSubmitted: 0,
      contactReveals: 0,
      outboundActions: 0
    }
  };
}
