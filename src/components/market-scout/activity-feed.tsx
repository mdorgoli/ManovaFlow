"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MarketScoutActivityFeed,
  MarketScoutReviewEvidenceState
} from "@/modules/growth/application/market-scout-activity-read-model";
import { parseMarketScoutActivitySnapshot, type MarketScoutActivitySnapshotV1 } from "@/modules/growth/application/market-scout-activity";
import { parseMarketScoutReviewEvidence } from "@/modules/growth/application/market-scout-review-evidence";
import { ActivityPanel } from "./activity-panel";
import { marketingPipelineSchema, type MarketingPipeline } from "@/modules/growth/application/marketing-workflow-contract";

interface FeedState {
  snapshot: MarketScoutActivitySnapshotV1 | null;
  loaded: boolean;
  refreshing: boolean;
  error: boolean;
  newSequences: number[];
  websiteReviewEvidence: MarketScoutReviewEvidenceState | null;
  marketingPipeline: MarketingPipeline | null;
}

export function ActivityFeed({ contractVersion }: { contractVersion: MarketScoutActivityFeed["contractVersion"] }) {
  const [state, setState] = useState<FeedState>({ snapshot: null, loaded: false, refreshing: true, error: false, newSequences: [], websiteReviewEvidence: null, marketingPipeline: null });
  const [now, setNow] = useState(0);
  const request = useRef<{ generation: number; controller: AbortController | null }>({ generation: 0, controller: null });

  const refresh = useCallback(async () => {
    request.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++request.current.generation;
    request.current.controller = controller;
    try {
      const response = await fetch("/api/market-scout/activity", { method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("ACTIVITY_UNAVAILABLE");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("contractVersion" in payload) || payload.contractVersion !== contractVersion || !("state" in payload) || !("snapshot" in payload) || !("websiteReviewEvidence" in payload) || !("marketingPipeline" in payload)) throw new Error("ACTIVITY_FEED_INVALID");
      let snapshot: MarketScoutActivitySnapshotV1 | null;
      let websiteReviewEvidence: MarketScoutReviewEvidenceState | null;
      let marketingPipeline: MarketingPipeline | null;
      if (payload.state === "EMPTY" && payload.snapshot === null && payload.websiteReviewEvidence === null && payload.marketingPipeline === null) {
        snapshot = null;
        websiteReviewEvidence = null;
        marketingPipeline = null;
      } else if (payload.state === "READY") {
        snapshot = parseMarketScoutActivitySnapshot(payload.snapshot);
        websiteReviewEvidence = parseReviewEvidenceState(
          payload.websiteReviewEvidence,
          snapshot
        );
        marketingPipeline = marketingPipelineSchema.parse(payload.marketingPipeline);
        if (marketingPipeline.state === "READY") {
          if (marketingPipeline.runId !== snapshot.runId || marketingPipeline.snapshotAt !== snapshot.snapshotAt ||
            snapshot.status !== "COMPLETED" || snapshot.query.laneKey !== "serviceflow" || snapshot.query.countryCode !== "FR" ||
            websiteReviewEvidence.state !== "READY" || marketingPipeline.prospects.length !== websiteReviewEvidence.bundle.reviews.length) throw new Error("ACTIVITY_WORKFLOW_MISMATCH");
          for (const [index, prospect] of marketingPipeline.prospects.entries()) {
            const review = websiteReviewEvidence.bundle.reviews[index]!;
            if (prospect.sourceUrl !== review.sourceUrl || prospect.reviewedAt !== review.occurredAt ||
              prospect.sourceReference !== `review:${snapshot.runId}:${index + 1}` ||
              JSON.stringify(prospect.prospector.facts) !== JSON.stringify(review.observedFacts) ||
              (prospect.qualifier.qualified && (review.outcome !== "SUCCEEDED" || review.instructionLikeTextDetected))) throw new Error("ACTIVITY_WORKFLOW_MISMATCH");
          }
        }
      } else throw new Error("ACTIVITY_FEED_INVALID");
      if (controller.signal.aborted || generation !== request.current.generation) return;
      const receivedAt = Date.now();
      setNow(receivedAt);
      setState((previous) => {
        // Initial history and a different run are recorded data, not arriving live events.
        const sameRun = previous.loaded && previous.snapshot?.runId === snapshot?.runId;
        const lastSequence = previous.snapshot?.events.at(-1)?.sequence ?? 0;
        return { snapshot, loaded: true, refreshing: false, error: false, websiteReviewEvidence, marketingPipeline, newSequences: sameRun && snapshot ? snapshot.events.filter((event) => event.sequence > lastSequence && receivedAt - Date.parse(event.occurredAt) <= snapshot.staleAfterMs && Date.parse(event.occurredAt) <= receivedAt).map((event) => event.sequence) : [] };
      });
    } catch {
      if (controller.signal.aborted || generation !== request.current.generation) return;
      // Do not retain data after authentication or tenant authorization may have changed.
      setState({ snapshot: null, loaded: true, refreshing: false, error: true, newSequences: [], websiteReviewEvidence: null, marketingPipeline: null });
    }
  }, [contractVersion]);

  useEffect(() => {
    const activeRequest = request.current;
    // The loader sets state only when its network response resolves or fails.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      activeRequest.controller?.abort();
      activeRequest.generation++;
      window.clearInterval(clock);
    };
  }, [refresh]);

  return <ActivityPanel snapshot={state.snapshot} websiteReviewEvidence={state.websiteReviewEvidence} marketingPipeline={state.marketingPipeline} now={now} refreshing={state.refreshing} error={state.error} newSequences={state.newSequences} onRefresh={() => {
    setState((previous) => ({ ...previous, refreshing: true, error: false, newSequences: [] }));
    void refresh();
  }} />;
}

function parseReviewEvidenceState(
  input: unknown,
  snapshot: MarketScoutActivitySnapshotV1
): MarketScoutReviewEvidenceState {
  if (!input || typeof input !== "object" || !("state" in input)) {
    throw new Error("ACTIVITY_REVIEW_EVIDENCE_INVALID");
  }
  if (input.state === "UNAVAILABLE") {
    if (
      !("reason" in input) ||
      input.reason !== "NOT_RECORDED" ||
      Object.keys(input).length !== 2
    ) {
      throw new Error("ACTIVITY_REVIEW_EVIDENCE_INVALID");
    }
    return { state: "UNAVAILABLE", reason: "NOT_RECORDED" };
  }
  if (input.state !== "READY" || !("bundle" in input) || Object.keys(input).length !== 2) {
    throw new Error("ACTIVITY_REVIEW_EVIDENCE_INVALID");
  }
  const bundle = parseMarketScoutReviewEvidence(input.bundle);
  const events = snapshot.events.filter((event) => event.stage === "WEBSITE_REVIEW");
  if (bundle.runId !== snapshot.runId || bundle.reviews.length !== events.length) {
    throw new Error("ACTIVITY_REVIEW_EVIDENCE_INVALID");
  }
  for (const review of bundle.reviews) {
    if (!events.some((event) =>
      event.sourceUrl === review.sourceUrl &&
      event.occurredAt === review.occurredAt &&
      event.outcome === review.outcome
    )) {
      throw new Error("ACTIVITY_REVIEW_EVIDENCE_INVALID");
    }
  }
  return { state: "READY", bundle };
}
