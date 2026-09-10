import { requireCapability } from "../domain/rbac";
import { LANE_KEYS, type ActorContext, type LaneKey, type MarketKey } from "../domain/types";
import type { CandidateInput } from "../domain/candidate-schema";
import { growthManifests } from "../manifests";
import { marketProfiles } from "../markets";
import type { GrowthRepository } from "./repository";
import type { MarketScoutLanguageMetadata } from "./market-scout-contracts";
import { runLane, type LaneReport } from "./run-lane";
import {
  withBoundedRetry,
  type RetryOptions
} from "./retry";

export type LaneOutcome =
  | { status: "fulfilled"; report: LaneReport; attempts: number }
  | { status: "rejected"; error: string; attempts: number };

export interface ParallelRunResult {
  batchKey: string;
  laneResults: Record<LaneKey, LaneOutcome>;
  aggregate: {
    lanesCompleted: number;
    lanesFailed: number;
    marketEvaluations: number;
    eligibleCompanies: number;
    draftsCreated: number;
    outboundActions: 0;
  };
}

export interface RunAllLanesInput {
  actor: ActorContext;
  batchKey: string;
  inputsByLane: Readonly<Record<LaneKey, readonly CandidateInput[]>>;
  repository: GrowthRepository;
  retry?: RetryOptions;
  marketKeys?: readonly MarketKey[];
  candidateLanguagesByLane?: Readonly<
    Partial<
      Record<
        LaneKey,
        Readonly<Record<string, MarketScoutLanguageMetadata>>
      >
    >
  >;
}

export async function runAllLanes(
  input: RunAllLanesInput
): Promise<ParallelRunResult> {
  requireCapability(input.actor, "RUN_RESEARCH");
  if (!input.batchKey.trim()) {
    throw new Error("Batch idempotency key is required");
  }

  const attempts = new Map<LaneKey, number>();
  const settled = await Promise.allSettled(
    LANE_KEYS.map((laneKey) =>
      withBoundedRetry(
        async (attempt) => {
          attempts.set(laneKey, attempt);
          const candidateLanguages =
            input.candidateLanguagesByLane?.[laneKey];
          return runLane({
            actor: input.actor,
            batchKey: input.batchKey,
            manifest: growthManifests[laneKey],
            markets: Object.values(marketProfiles).filter(market => !input.marketKeys || input.marketKeys.includes(market.key)),
            candidates: input.inputsByLane[laneKey],
            repository: input.repository,
            ...(candidateLanguages ? { candidateLanguages } : {})
          });
        },
        input.retry
      )
    )
  );

  const entries = LANE_KEYS.map((laneKey, index) => {
    const outcome = settled[index];
    if (!outcome) {
      throw new Error("Missing settled lane result");
    }
    const value: LaneOutcome =
      outcome.status === "fulfilled"
        ? {
            status: "fulfilled",
            report: outcome.value,
            attempts: attempts.get(laneKey) ?? 1
          }
        : {
            status: "rejected",
            error: errorMessage(outcome.reason),
            attempts: attempts.get(laneKey) ?? 1
          };
    return [laneKey, value] as const;
  });
  const laneResults = Object.fromEntries(entries) as Record<
    LaneKey,
    LaneOutcome
  >;
  const reports = Object.values(laneResults)
    .filter(
      (outcome): outcome is Extract<LaneOutcome, { status: "fulfilled" }> =>
        outcome.status === "fulfilled"
    )
    .map((outcome) => outcome.report);

  return {
    batchKey: input.batchKey,
    laneResults,
    aggregate: {
      lanesCompleted: reports.length,
      lanesFailed: LANE_KEYS.length - reports.length,
      marketEvaluations: reports.reduce(
        (sum, report) => sum + report.marketShortlist.length,
        0
      ),
      eligibleCompanies: reports.reduce(
        (sum, report) => sum + report.companyShortlist.length,
        0
      ),
      draftsCreated: reports.reduce(
        (sum, report) => sum + report.drafts.length,
        0
      ),
      outboundActions: 0
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown lane failure";
}
