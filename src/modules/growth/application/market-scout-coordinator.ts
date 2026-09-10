import { requireCapability } from "../domain/rbac";
import {
  LANE_KEYS,
  type ActorContext,
  type LaneKey,
  type MarketKey
} from "../domain/types";
import { growthManifests } from "../manifests";
import { marketProfiles, type MarketProfile } from "../markets";
import type { GrowthRepository } from "./repository";
import { normalizeDomain } from "./repository";
import {
  type MarketScoutBudget,
  type MarketScoutDirection,
  type MarketScoutResearchLanguage,
  type MarketScoutLanguageBasis,
  type MarketScoutLanguageMetadata,
  type MarketScoutSource,
  type MarketScoutTask
} from "./market-scout-contracts";
import {
  runMarketScoutWorker,
  type MarketScoutWorkerResult
} from "./market-scout-worker";
import {
  runAllLanes,
  type ParallelRunResult,
  type RunAllLanesInput
} from "./run-parallel";

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 12;

export interface MarketScoutCoordinatorInput {
  actor: ActorContext;
  batchKey: string;
  source: MarketScoutSource;
  repository: GrowthRepository;
  concurrency?: number;
  retry?: RunAllLanesInput["retry"];
  scope?: MarketScoutScope;
}

export interface MarketScoutScope {
  countryCode: string;
  laneKey: LaneKey;
}

export type MarketScoutWorkerOutcome =
  | {
      task: MarketScoutTask;
      status: "fulfilled";
      result: MarketScoutWorkerResult;
    }
  | {
      task: MarketScoutTask;
      status: "rejected";
      errorCode: MarketScoutWorkerErrorCode;
    };

export type MarketScoutWorkerErrorCode =
  | "MARKET_SCOUT_SOURCE_FAILED"
  | "MARKET_SCOUT_SOURCE_ENVELOPE_INVALID"
  | "MARKET_SCOUT_SOURCE_BUDGET_EXCEEDED"
  | "MARKET_SCOUT_SOURCE_TIME_BUDGET_EXCEEDED";

export interface MarketScoutInternalDraft {
  draftId: string;
  companyId: string;
  laneKey: LaneKey;
  marketKey: MarketKey;
  language: MarketScoutResearchLanguage;
  direction: MarketScoutDirection;
  languageBasis: MarketScoutLanguageBasis;
  subject: string;
  body: string;
  state: "INTERNAL_ONLY";
  outboundEnabled: false;
}

export interface MarketScoutResult {
  batchKey: string;
  humanSend: "BLOCKED";
  workerOutcomes: MarketScoutWorkerOutcome[];
  research: ParallelRunResult;
  internalDrafts: MarketScoutInternalDraft[];
  aggregate: {
    workersCompleted: number;
    workersFailed: number;
    sourceUrlsReviewed: number;
    organizationsReturned: number;
    acceptedCandidates: number;
    rejectedCandidates: number;
    outboundActions: 0;
  };
}

interface WorkerAssignment {
  task: MarketScoutTask;
  budget: MarketScoutBudget;
  market: MarketProfile;
}

export async function runMarketScout(
  input: MarketScoutCoordinatorInput
): Promise<MarketScoutResult> {
  requireCapability(input.actor, "RUN_RESEARCH");
  const batchKey = input.batchKey.trim();
  if (!batchKey) throw new Error("Batch idempotency key is required");
  const concurrency = input.concurrency ?? DEFAULT_CONCURRENCY;
  if (
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > MAX_CONCURRENCY
  ) {
    throw new Error(
      "Market Scout concurrency must be an integer from 1 through 12"
    );
  }

  const assignments = buildAssignments(input.scope);
  const workerOutcomes = await runBounded(
    assignments,
    concurrency,
    async (assignment): Promise<MarketScoutWorkerOutcome> => {
      try {
        const result = await runMarketScoutWorker({
          source: input.source,
          task: assignment.task,
          manifest: growthManifests[assignment.task.laneKey],
          market: assignment.market,
          budget: assignment.budget
        });
        return { task: assignment.task, status: "fulfilled", result };
      } catch (error) {
        return {
          task: assignment.task,
          status: "rejected",
          errorCode: safeWorkerErrorCode(error)
        };
      }
    }
  );

  const inputsByLane = emptyLaneCandidates();
  const candidateLanguagesByLane = emptyLaneLanguages();
  for (const outcome of workerOutcomes) {
    if (outcome.status !== "fulfilled") continue;
    for (const accepted of outcome.result.acceptedCandidates) {
      inputsByLane[accepted.candidate.laneKey].push(accepted.candidate);
      candidateLanguagesByLane[accepted.candidate.laneKey][
        normalizeDomain(accepted.candidate.domain)
      ] = {
        language: accepted.language,
        direction: accepted.direction,
        languageBasis: accepted.languageBasis
      };
    }
  }

  const research = await runAllLanes({
    actor: input.actor,
    batchKey,
    inputsByLane,
    repository: input.repository,
    candidateLanguagesByLane,
    ...(input.scope ? { marketKeys: [...new Set(assignments.map(item => item.market.key))] } : {}),
    ...(input.retry ? { retry: input.retry } : {})
  });
  const internalDrafts = collectInternalDrafts(research);
  const completed = workerOutcomes.filter(
    (outcome): outcome is Extract<
      MarketScoutWorkerOutcome,
      { status: "fulfilled" }
    > => outcome.status === "fulfilled"
  );

  return {
    batchKey,
    humanSend: "BLOCKED",
    workerOutcomes,
    research,
    internalDrafts,
    aggregate: {
      workersCompleted: completed.length,
      workersFailed: workerOutcomes.length - completed.length,
      sourceUrlsReviewed: completed.reduce(
        (total, outcome) => total + outcome.result.sourceUrlsReviewed,
        0
      ),
      organizationsReturned: completed.reduce(
        (total, outcome) => total + outcome.result.organizationsReturned,
        0
      ),
      acceptedCandidates: completed.reduce(
        (total, outcome) => total + outcome.result.acceptedCandidates.length,
        0
      ),
      rejectedCandidates: completed.reduce(
        (total, outcome) =>
          total +
          Object.values(outcome.result.rejectionCounts).reduce(
            (sum, count) => sum + count,
            0
          ),
        0
      ),
      outboundActions: 0
    }
  };
}

function buildAssignments(scope?: MarketScoutScope): WorkerAssignment[] {
  const markets = Object.values(marketProfiles);
  if (scope) {
    const countryCode = scope.countryCode.trim().toUpperCase();
    const market = markets.find(
      (item) => item.geography.countryCode === countryCode
    );
    if (!market) throw new Error("MARKET_SCOUT_COUNTRY_NOT_CONFIGURED");
    const manifest = growthManifests[scope.laneKey];
    return [{
      task: { laneKey: scope.laneKey, marketKey: market.key },
      market,
      budget: {
        maxSourceUrls: 1,
        maxOrganizations: Math.min(3, manifest.dailyCaps.organizations),
        maxElapsedMs: manifest.dailyCaps.elapsedMs
      }
    }];
  }
  return LANE_KEYS.flatMap((laneKey) => {
    const manifest = growthManifests[laneKey];
    const selected = markets.slice(0, manifest.dailyCaps.markets);
    return selected.map((market, index) => ({
      task: { laneKey, marketKey: market.key },
      market,
      budget: {
        maxSourceUrls: partition(
          manifest.dailyCaps.sourceUrls,
          index,
          selected.length
        ),
        maxOrganizations: partition(
          manifest.dailyCaps.organizations,
          index,
          selected.length
        ),
        maxElapsedMs: manifest.dailyCaps.elapsedMs
      }
    }));
  });
}

function partition(total: number, index: number, parts: number): number {
  const base = Math.floor(total / parts);
  return base + (index < total % parts ? 1 : 0);
}

async function runBounded<TInput, TResult>(
  inputs: readonly TInput[],
  concurrency: number,
  operation: (input: TInput) => Promise<TResult>
): Promise<TResult[]> {
  const results = new Array<TResult>(inputs.length);
  let nextIndex = 0;
  const runner = async () => {
    while (nextIndex < inputs.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = inputs[index];
      if (item === undefined) throw new Error("Missing Market Scout assignment");
      results[index] = await operation(item);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, inputs.length) },
      async () => runner()
    )
  );
  return results;
}

function emptyLaneCandidates(): Record<
  LaneKey,
  Array<Parameters<typeof runAllLanes>[0]["inputsByLane"][LaneKey][number]>
> {
  return { serviceflow: [], beautyflow: [], briefflow: [] };
}

function emptyLaneLanguages(): Record<
  LaneKey,
  Record<string, MarketScoutLanguageMetadata>
> {
  return { serviceflow: {}, beautyflow: {}, briefflow: {} };
}

function collectInternalDrafts(
  research: ParallelRunResult
): MarketScoutInternalDraft[] {
  return LANE_KEYS.flatMap((laneKey) => {
    const outcome = research.laneResults[laneKey];
    if (outcome.status !== "fulfilled") return [];
    return outcome.report.drafts.flatMap((draft) => {
      const company = outcome.report.companyShortlist.find(
        (item) => item.companyId === draft.companyId
      );
      if (
        !company?.language ||
        !company.direction ||
        !company.languageBasis
      ) {
        return [];
      }
      return [
        {
          draftId: draft.id,
          companyId: draft.companyId,
          laneKey,
          marketKey: company.marketKey,
          language: company.language,
          direction: company.direction,
          languageBasis: company.languageBasis,
          subject: draft.subject,
          body: draft.body,
          state: "INTERNAL_ONLY" as const,
          outboundEnabled: false as const
        }
      ];
    });
  });
}

function safeWorkerErrorCode(error: unknown): MarketScoutWorkerErrorCode {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "MARKET_SCOUT_SOURCE_ENVELOPE_INVALID" ||
    message === "MARKET_SCOUT_SOURCE_BUDGET_EXCEEDED" ||
    message === "MARKET_SCOUT_SOURCE_TIME_BUDGET_EXCEEDED"
  ) {
    return message;
  }
  return "MARKET_SCOUT_SOURCE_FAILED";
}
