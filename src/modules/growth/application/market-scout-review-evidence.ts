import { z } from "zod";
import {
  WEBSITE_REVIEW_FACTS,
  type WebsiteReviewFact,
  type WebsiteReviewResult
} from "./market-scout-website-review";

export const MARKET_SCOUT_REVIEW_EVIDENCE_VERSION =
  "manovaflow.market-scout.website-review-evidence.v1" as const;

export const WEBSITE_REVIEW_UNKNOWNS = [
  "WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
  "WORKFLOW_PAIN_UNVERIFIED",
  "BUYER_AUTHORITY_UNVERIFIED",
  "CUSTOMER_INTEREST_UNVERIFIED"
] as const;

export type WebsiteReviewUnknown = (typeof WEBSITE_REVIEW_UNKNOWNS)[number];

const isoTimestamp = z
  .string()
  .max(24)
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    "Timestamp must use canonical UTC ISO format"
  )
  .refine((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  }, "Timestamp must be a valid canonical UTC instant");
const httpsUrl = z
  .string()
  .max(2_048)
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Evidence source must be a credential-free HTTPS URL");

const reviewSchema = z
  .strictObject({
    sourceUrl: httpsUrl,
    occurredAt: isoTimestamp,
    outcome: z.enum(["SUCCEEDED", "REJECTED", "FAILED", "SKIPPED"]),
    observedFacts: z
      .array(z.enum(WEBSITE_REVIEW_FACTS))
      .max(WEBSITE_REVIEW_FACTS.length),
    potentialFit: z.enum(["HUMAN_REVIEW_REQUIRED", "NOT_ASSESSED"]),
    unknowns: z
      .array(z.enum(WEBSITE_REVIEW_UNKNOWNS))
      .max(WEBSITE_REVIEW_UNKNOWNS.length),
    requestsMade: z.number().int().min(0).max(4),
    bytesRead: z.number().int().min(0).max(320_000),
    instructionLikeTextDetected: z.boolean()
  })
  .superRefine((review, context) => {
    if (new Set(review.observedFacts).size !== review.observedFacts.length) {
      context.addIssue({
        code: "custom",
        path: ["observedFacts"],
        message: "Observed facts must be unique"
      });
    }
    if (new Set(review.unknowns).size !== review.unknowns.length) {
      context.addIssue({
        code: "custom",
        path: ["unknowns"],
        message: "Unknowns must be unique"
      });
    }
    if (review.outcome !== "SUCCEEDED" && review.observedFacts.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["observedFacts"],
        message: "Non-successful reviews cannot carry observed facts"
      });
    }
    if (
      review.outcome !== "SUCCEEDED" &&
      review.potentialFit !== "NOT_ASSESSED"
    ) {
      context.addIssue({
        code: "custom",
        path: ["potentialFit"],
        message: "Non-successful reviews cannot assert potential fit"
      });
    }
    const expected =
      review.outcome === "SUCCEEDED" && review.observedFacts.length > 0
        ? "HUMAN_REVIEW_REQUIRED"
        : "NOT_ASSESSED";
    if (review.potentialFit !== expected) {
      context.addIssue({
        code: "custom",
        path: ["potentialFit"],
        message: "Potential fit must be derived from observed facts"
      });
    }
  });

export const marketScoutReviewEvidenceSchema = z
  .strictObject({
    contractVersion: z.literal(MARKET_SCOUT_REVIEW_EVIDENCE_VERSION),
    runId: z.string().trim().min(1).max(200),
    reviews: z.array(reviewSchema).max(3),
    safety: z.strictObject({
      paidSpend: z.literal(0),
      apolloCredits: z.literal(0),
      messagesSent: z.literal(0),
      formsSubmitted: z.literal(0),
      contactReveals: z.literal(0),
      outboundActions: z.literal(0)
    })
  })
  .superRefine((bundle, context) => {
    const keys = bundle.reviews.map(
      (review) => `${review.sourceUrl}\u0000${review.occurredAt}`
    );
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["reviews"],
        message: "Review evidence entries must be unique"
      });
    }
  });

export type MarketScoutReviewEvidenceV1 = z.infer<
  typeof marketScoutReviewEvidenceSchema
>;

export interface CreateMarketScoutReviewEvidenceInput {
  runId: string;
  reviews: readonly {
    review: WebsiteReviewResult;
    occurredAt: string;
  }[];
}

export function createMarketScoutReviewEvidence(
  input: CreateMarketScoutReviewEvidenceInput
): MarketScoutReviewEvidenceV1 {
  const bundle = {
    contractVersion: MARKET_SCOUT_REVIEW_EVIDENCE_VERSION,
    runId: input.runId,
    reviews: input.reviews.map(({ review, occurredAt }) => {
      const observedFacts =
        review.outcome === "SUCCEEDED"
          ? uniqueAllowlistedFacts(review.documentedFacts)
          : [];
      return {
        sourceUrl: review.sourceUrl,
        occurredAt,
        outcome: review.outcome,
        observedFacts,
        potentialFit:
          observedFacts.length > 0
            ? ("HUMAN_REVIEW_REQUIRED" as const)
            : ("NOT_ASSESSED" as const),
        unknowns: uniqueAllowlistedUnknowns(review.unknowns),
        requestsMade: review.requestsMade,
        bytesRead: review.bytesRead,
        instructionLikeTextDetected: review.untrustedInstructionTextDetected
      };
    }),
    safety: {
      paidSpend: 0 as const,
      apolloCredits: 0 as const,
      messagesSent: 0 as const,
      formsSubmitted: 0 as const,
      contactReveals: 0 as const,
      outboundActions: 0 as const
    }
  };
  return marketScoutReviewEvidenceSchema.parse(bundle);
}

export function parseMarketScoutReviewEvidence(
  input: unknown
): MarketScoutReviewEvidenceV1 {
  return marketScoutReviewEvidenceSchema.parse(input);
}

function uniqueAllowlistedFacts(
  values: readonly WebsiteReviewFact[]
): WebsiteReviewFact[] {
  const allowed = new Set<string>(WEBSITE_REVIEW_FACTS);
  return [...new Set(values.filter((value) => allowed.has(value)))];
}

function uniqueAllowlistedUnknowns(
  values: readonly string[]
): WebsiteReviewUnknown[] {
  const allowed = new Set<string>(WEBSITE_REVIEW_UNKNOWNS);
  return [
    ...new Set(
      values.filter((value): value is WebsiteReviewUnknown =>
        allowed.has(value)
      )
    )
  ];
}
