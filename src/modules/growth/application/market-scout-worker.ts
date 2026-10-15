import { z } from "zod";
import { parseCandidate } from "../domain/candidate-schema";
import type { VerticalManifest } from "../manifests";
import type { MarketProfile } from "../markets";
import {
  MARKET_SCOUT_REJECTION_CODES,
  PUBLIC_MARKET_SCOUT_SOURCE_KINDS,
  type AcceptedMarketScoutCandidate,
  type MarketScoutBudget,
  type MarketScoutRejectionCode,
  type MarketScoutRejectionCounts,
  type MarketScoutSource,
  type MarketScoutTask
} from "./market-scout-contracts";
import { detectMarketScoutLanguage } from "./market-scout-language";

const discoveryEnvelopeSchema = z.strictObject({
  sourceUrlsReviewed: z.number().int().nonnegative(),
  paidSpend: z.literal(0),
  candidates: z.array(
    z.strictObject({
      candidate: z.unknown(),
      publicText: z.string().trim().min(1).max(4_000)
    })
  )
});

export interface MarketScoutWorkerInput {
  source: MarketScoutSource;
  task: MarketScoutTask;
  manifest: VerticalManifest;
  market: MarketProfile;
  budget: MarketScoutBudget;
}

export interface MarketScoutWorkerResult {
  task: MarketScoutTask;
  budget: MarketScoutBudget;
  sourceUrlsReviewed: number;
  organizationsReturned: number;
  acceptedCandidates: AcceptedMarketScoutCandidate[];
  rejectionCounts: MarketScoutRejectionCounts;
}

export async function runMarketScoutWorker(
  input: MarketScoutWorkerInput
): Promise<MarketScoutWorkerResult> {
  validateWorkerInput(input);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort("MARKET_SCOUT_SOURCE_TIME_BUDGET_EXCEEDED");
        reject(new Error("MARKET_SCOUT_SOURCE_TIME_BUDGET_EXCEEDED"));
      }, input.budget.maxElapsedMs);
    });
    const rawEnvelope = await Promise.race([
      input.source.discover({
        task: input.task,
        budget: input.budget,
        signal: controller.signal
      }),
      timedOut
    ]);
    const parsedEnvelope = discoveryEnvelopeSchema.safeParse(rawEnvelope);
    if (!parsedEnvelope.success) {
      throw new Error("MARKET_SCOUT_SOURCE_ENVELOPE_INVALID");
    }
    const envelope = parsedEnvelope.data;
    if (
      envelope.sourceUrlsReviewed > input.budget.maxSourceUrls ||
      envelope.candidates.length > input.budget.maxOrganizations
    ) {
      throw new Error("MARKET_SCOUT_SOURCE_BUDGET_EXCEEDED");
    }

    const rejectionCounts = emptyRejectionCounts();
    const acceptedCandidates: AcceptedMarketScoutCandidate[] = [];
    for (const item of envelope.candidates) {
      const parsedCandidate = tryCandidate(item.candidate);
      if (!parsedCandidate) {
        rejectionCounts.INVALID_CANDIDATE += 1;
        continue;
      }
      if (parsedCandidate.synthetic) {
        rejectionCounts.SYNTHETIC_RECORD_FORBIDDEN += 1;
        continue;
      }
      if (!isPublicSourceKind(parsedCandidate.sourceKind)) {
        rejectionCounts.NON_PUBLIC_SOURCE_KIND += 1;
        continue;
      }
      if (
        !input.market.allowedSourceKinds.includes(parsedCandidate.sourceKind)
      ) {
        rejectionCounts.SOURCE_KIND_NOT_ALLOWLISTED += 1;
        continue;
      }
      if (
        parsedCandidate.laneKey !== input.task.laneKey ||
        parsedCandidate.marketKey !== input.task.marketKey ||
        parsedCandidate.country !== input.market.geography.countryCode
      ) {
        rejectionCounts.TASK_SCOPE_MISMATCH += 1;
        continue;
      }

      const detected = detectMarketScoutLanguage({
        text: item.publicText,
        marketLocales: input.market.locales
      });
      acceptedCandidates.push({
        candidate: parsedCandidate,
        language: detected.language,
        direction: detected.direction,
        languageBasis: detected.basis
      });
    }

    return {
      task: input.task,
      budget: input.budget,
      sourceUrlsReviewed: envelope.sourceUrlsReviewed,
      organizationsReturned: envelope.candidates.length,
      acceptedCandidates,
      rejectionCounts
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function validateWorkerInput(input: MarketScoutWorkerInput): void {
  if (
    input.manifest.key !== input.task.laneKey ||
    input.market.key !== input.task.marketKey
  ) {
    throw new Error("MARKET_SCOUT_TASK_CONFIGURATION_INVALID");
  }
  const values = [
    input.budget.maxSourceUrls,
    input.budget.maxOrganizations,
    input.budget.maxElapsedMs
  ];
  if (
    values.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    input.budget.maxElapsedMs < 1
  ) {
    throw new Error("MARKET_SCOUT_BUDGET_INVALID");
  }
}

function tryCandidate(input: unknown) {
  try {
    return parseCandidate(input);
  } catch {
    return null;
  }
}

function isPublicSourceKind(
  sourceKind: string
): sourceKind is (typeof PUBLIC_MARKET_SCOUT_SOURCE_KINDS)[number] {
  return (PUBLIC_MARKET_SCOUT_SOURCE_KINDS as readonly string[]).includes(
    sourceKind
  );
}

function emptyRejectionCounts(): MarketScoutRejectionCounts {
  return Object.fromEntries(
    MARKET_SCOUT_REJECTION_CODES.map((code) => [code, 0])
  ) as Record<MarketScoutRejectionCode, number>;
}
