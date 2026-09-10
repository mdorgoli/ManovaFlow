import { z } from "zod";
import { LANE_KEYS, type LaneKey } from "../domain/types";

export const MARKET_SCOUT_ACTIVITY_CONTRACT_VERSION =
  "manovaflow.market-scout.activity.v1" as const;
export const MARKET_SCOUT_ACTIVITY_STALE_AFTER_MS = 15_000 as const;

export type MarketScoutActivityStatus =
  | "IDLE"
  | "RUNNING"
  | "STOPPED"
  | "FAILED"
  | "COMPLETED";

export interface MarketScoutActivityEventV1 {
  sequence: number;
  occurredAt: string;
  stage: "DISCOVERY" | "ROBOTS_CHECK" | "WEBSITE_REVIEW";
  sourceUrl: string;
  outcome: "SUCCEEDED" | "REJECTED" | "FAILED" | "SKIPPED";
  decision: string;
  reason: string;
  errorCode: string | null;
}

export interface MarketScoutActivitySnapshotV1 {
  contractVersion: typeof MARKET_SCOUT_ACTIVITY_CONTRACT_VERSION;
  runId: string;
  agent: "market-scout";
  status: MarketScoutActivityStatus;
  startedAt: string | null;
  query: {
    origin: "SEARCH" | "SEED";
    countryCode: string;
    laneKey: LaneKey;
    filter: string;
  };
  events: MarketScoutActivityEventV1[];
  finishedAt: string | null;
  snapshotAt: string;
  staleAfterMs: typeof MARKET_SCOUT_ACTIVITY_STALE_AFTER_MS;
}

const isoTimestamp = z.string().refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Timestamp must be an ISO-compatible date"
);
const httpsUrl = z.string().url().refine(
  (value) => new URL(value).protocol === "https:",
  "Source URL must use HTTPS"
);

export const marketScoutActivitySnapshotSchema = z.strictObject({
  contractVersion: z.literal(MARKET_SCOUT_ACTIVITY_CONTRACT_VERSION),
  runId: z.string().trim().min(1).max(200),
  agent: z.literal("market-scout"),
  status: z.enum(["IDLE", "RUNNING", "STOPPED", "FAILED", "COMPLETED"]),
  startedAt: isoTimestamp.nullable(),
  query: z.strictObject({
    origin: z.enum(["SEARCH", "SEED"]),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    laneKey: z.enum(LANE_KEYS),
    filter: z.string().trim().min(1).max(2_000)
  }),
  events: z.array(z.strictObject({
    sequence: z.number().int().positive(),
    occurredAt: isoTimestamp,
    stage: z.enum(["DISCOVERY", "ROBOTS_CHECK", "WEBSITE_REVIEW"]),
    sourceUrl: httpsUrl,
    outcome: z.enum(["SUCCEEDED", "REJECTED", "FAILED", "SKIPPED"]),
    decision: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(200),
    errorCode: z.string().trim().min(1).max(200).nullable()
  })).max(100),
  finishedAt: isoTimestamp.nullable(),
  snapshotAt: isoTimestamp,
  staleAfterMs: z.literal(MARKET_SCOUT_ACTIVITY_STALE_AFTER_MS)
});

type UnsequencedEvent = Omit<MarketScoutActivityEventV1, "sequence">;

export interface CreateMarketScoutActivityInput {
  runId: string;
  status: MarketScoutActivityStatus;
  startedAt: string | null;
  finishedAt: string | null;
  snapshotAt: string;
  query: MarketScoutActivitySnapshotV1["query"];
  events: readonly UnsequencedEvent[];
}

export function createMarketScoutActivity(
  input: CreateMarketScoutActivityInput
): MarketScoutActivitySnapshotV1 {
  if (!input.runId.trim()) throw new Error("MARKET_SCOUT_ACTIVITY_RUN_ID_REQUIRED");
  if (!input.query.filter.trim()) {
    throw new Error("MARKET_SCOUT_ACTIVITY_QUERY_FILTER_REQUIRED");
  }
  assertTimestamp(input.snapshotAt);
  if (input.startedAt) assertTimestamp(input.startedAt);
  if (input.finishedAt) assertTimestamp(input.finishedAt);
  const events = input.events.map((event, index) => {
    assertTimestamp(event.occurredAt);
    assertHttpsUrl(event.sourceUrl);
    if (!event.decision.trim() || !event.reason.trim()) {
      throw new Error("MARKET_SCOUT_ACTIVITY_EVENT_DETAILS_REQUIRED");
    }
    return { ...event, sequence: index + 1 };
  });
  return {
    contractVersion: MARKET_SCOUT_ACTIVITY_CONTRACT_VERSION,
    runId: input.runId,
    agent: "market-scout",
    status: input.status,
    startedAt: input.startedAt,
    query: { ...input.query },
    events,
    finishedAt: input.finishedAt,
    snapshotAt: input.snapshotAt,
    staleAfterMs: MARKET_SCOUT_ACTIVITY_STALE_AFTER_MS
  };
}

export function parseMarketScoutActivitySnapshot(
  input: unknown
): MarketScoutActivitySnapshotV1 {
  return marketScoutActivitySnapshotSchema.parse(input);
}

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error("MARKET_SCOUT_ACTIVITY_TIMESTAMP_INVALID");
  }
}

function assertHttpsUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("MARKET_SCOUT_ACTIVITY_SOURCE_URL_INVALID");
  }
}
