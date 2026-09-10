import type { DashboardSnapshot } from "./repository";
import type { ActorContext } from "../domain/types";
import { buildMarketingPipeline } from "./marketing-workflow";
import type { MarketingPipeline } from "./marketing-workflow-contract";
import {
  parseMarketScoutActivitySnapshot,
  type MarketScoutActivitySnapshotV1
} from "./market-scout-activity";
import {
  parseMarketScoutReviewEvidence,
  type MarketScoutReviewEvidenceV1
} from "./market-scout-review-evidence";

export const MARKET_SCOUT_ACTIVITY_FEED_VERSION =
  "manovaflow.market-scout.activity-feed.v3" as const;

export type MarketScoutReviewEvidenceState =
  | {
      state: "UNAVAILABLE";
      reason: "NOT_RECORDED";
    }
  | {
      state: "READY";
      bundle: MarketScoutReviewEvidenceV1;
    };

export type MarketScoutActivityFeed =
  | {
      contractVersion: typeof MARKET_SCOUT_ACTIVITY_FEED_VERSION;
      state: "EMPTY";
      snapshot: null;
      websiteReviewEvidence: null;
      marketingPipeline: null;
    }
  | {
      contractVersion: typeof MARKET_SCOUT_ACTIVITY_FEED_VERSION;
      state: "READY";
      snapshot: MarketScoutActivitySnapshotV1;
      websiteReviewEvidence: MarketScoutReviewEvidenceState;
      marketingPipeline: MarketingPipeline;
    };

export class MarketScoutActivityReadModelError extends Error {
  constructor() {
    super("MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID");
    this.name = "MarketScoutActivityReadModelError";
  }
}

export function buildMarketScoutActivityFeed(
  actor: ActorContext,
  dashboard: DashboardSnapshot
): MarketScoutActivityFeed {
  try {
    if (dashboard.audit.some((event) => event.tenantId !== actor.tenantId)) {
      throw new Error("CROSS_TENANT_AUDIT_ROW");
    }
    const latest = dashboard.audit
      .filter((event) => event.eventType === "MARKET_SCOUT_ACTIVITY_SNAPSHOT")
      .sort((left, right) => right.sequence - left.sequence)[0];
    if (!latest) {
      return {
        contractVersion: MARKET_SCOUT_ACTIVITY_FEED_VERSION,
        state: "EMPTY",
        snapshot: null,
        websiteReviewEvidence: null,
        marketingPipeline: null
      };
    }
    const snapshot = parseMarketScoutActivitySnapshot(
      latest.details.activity
    );
    if (
      latest.entityId !== snapshot.runId ||
      latest.laneKey !== snapshot.query.laneKey ||
      snapshot.events.some((event, index) => event.sequence !== index + 1)
    ) {
      throw new Error("ACTIVITY_AUDIT_INVARIANT_VIOLATION");
    }
    const websiteReviewEvidence = readWebsiteReviewEvidence(
      latest.details.websiteReviewEvidence,
      snapshot
    );
    return {
      contractVersion: MARKET_SCOUT_ACTIVITY_FEED_VERSION,
      state: "READY",
      snapshot,
      websiteReviewEvidence,
      marketingPipeline: buildMarketingPipeline(actor, dashboard, snapshot, websiteReviewEvidence)
    };
  } catch {
    throw new MarketScoutActivityReadModelError();
  }
}

function readWebsiteReviewEvidence(
  input: unknown,
  snapshot: MarketScoutActivitySnapshotV1
): MarketScoutReviewEvidenceState {
  if (input === undefined) {
    return { state: "UNAVAILABLE", reason: "NOT_RECORDED" };
  }
  const bundle = parseMarketScoutReviewEvidence(input);
  if (bundle.runId !== snapshot.runId) {
    throw new Error("REVIEW_EVIDENCE_RUN_MISMATCH");
  }
  const reviewEvents = snapshot.events.filter(
    (event) => event.stage === "WEBSITE_REVIEW"
  );
  if (bundle.reviews.length !== reviewEvents.length) {
    throw new Error("REVIEW_EVIDENCE_EVENT_COUNT_MISMATCH");
  }
  for (const review of bundle.reviews) {
    const matches = reviewEvents.some(
      (event) =>
        event.sourceUrl === review.sourceUrl &&
        event.occurredAt === review.occurredAt &&
        event.outcome === review.outcome
    );
    if (!matches) throw new Error("REVIEW_EVIDENCE_EVENT_MISMATCH");
  }
  return { state: "READY", bundle };
}
