import { z } from "zod";

// An independent research task; it does not create a Growth product/lane or lead.
export const AHVAZ_CAR_SCOUT_SCOPE = "AHVAZ-CAR-SCOUT-1" as const;
export const AHVAZ_CAR_SCOUT_VERSION = "manovaflow.ahvaz-car-scout.v1" as const;
export const AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY = "ahvaz-car-scout-1-osm-v1" as const;
export const AHVAZ_CAR_SCOUT_BBOX = [31.15, 48.40, 31.60, 48.95] as const;
export const AHVAZ_CAR_SCOUT_BUDGET = Object.freeze({
  maxRequests: 1,
  maxRows: 200,
  maxElapsedMs: 30_000,
  maxResponseBytes: 512_000,
  paidSpend: 0
});

const timestamp = z.string().refine((value) =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
"A canonical UTC timestamp is required");
const count = z.number().int().nonnegative().max(201);

/** URL is reported by OSM, never visited or asserted to belong to the business. */
export function safeCarScoutWebsite(value: string): string | null {
  if (!value.trim() || value.length > 2048 || /[\s\\<>]/u.test(value.trim())) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/u.test(hostname)) return null;
    if (/(?:^|\.)(?:localhost|local|internal|intranet|home|lan|test|invalid|example|onion)$/u.test(hostname)) return null;
    url.hostname = hostname;
    // Query parameters and fragments are unnecessary for the public site reference.
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export const carScoutNameSchema = z.string().trim().min(2).max(160).refine((name) =>
  !/[<>@\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]|https?:\/\/|www\./iu.test(name) &&
  !/[0-9۰-۹٠-٩](?:[0-9۰-۹٠-٩\s()+.-]*[0-9۰-۹٠-٩]){6}/u.test(name),
"Only a business display name without contact data is accepted");

const websiteSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("RECORDED"),
    url: z.string().max(2048).refine((value) => safeCarScoutWebsite(value) === value),
    tag: z.enum(["website", "contact:website"])
  }),
  z.strictObject({ state: z.literal("NOT_RECORDED"), url: z.null(), tag: z.null() }),
  z.strictObject({ state: z.literal("REJECTED_UNSAFE"), url: z.null(), tag: z.null() })
]);

export const carScoutObservationSchema = z.strictObject({
  osmType: z.enum(["node", "way", "relation"]),
  osmId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  observationId: z.string(),
  name: carScoutNameSchema,
  latitude: z.number().min(AHVAZ_CAR_SCOUT_BBOX[0]).max(AHVAZ_CAR_SCOUT_BBOX[2]),
  longitude: z.number().min(AHVAZ_CAR_SCOUT_BBOX[1]).max(AHVAZ_CAR_SCOUT_BBOX[3]),
  category: z.literal("shop=car"),
  sourceUrl: z.string(),
  observedAt: timestamp,
  website: websiteSchema
}).superRefine((row, context) => {
  if (row.observationId !== `osm:${row.osmType}:${row.osmId}` ||
      row.sourceUrl !== `https://www.openstreetmap.org/${row.osmType}/${row.osmId}`) {
    context.addIssue({ code: "custom", message: "OSM identity and evidence must agree" });
  }
});

export const carScoutRejectionsSchema = z.strictObject({
  INVALID_RECORD: count,
  WRONG_CATEGORY: count,
  OUTSIDE_BOUNDS: count,
  DUPLICATE_OSM_ID: count,
  OUTPUT_LIMIT: count
});

export const carScoutDiscoverySchema = z.strictObject({
  observedAt: timestamp,
  sourceSnapshotAt: timestamp.nullable(),
  elementsReturned: count,
  limitReached: z.boolean(),
  rejections: carScoutRejectionsSchema,
  rows: z.array(carScoutObservationSchema).max(AHVAZ_CAR_SCOUT_BUDGET.maxRows)
}).superRefine((data, context) => {
  if (data.rows.length + Object.values(data.rejections).reduce((a, b) => a + b, 0) !== data.elementsReturned ||
      data.rows.some((row) => row.observedAt !== data.observedAt) ||
      new Set(data.rows.map((row) => row.observationId)).size !== data.rows.length ||
      data.limitReached !== (data.elementsReturned > AHVAZ_CAR_SCOUT_BUDGET.maxRows)) {
    context.addIssue({ code: "custom", message: "Discovery counters or evidence do not agree" });
  }
});

export const CAR_SCOUT_FAILURE_CODES = [
  "SOURCE_TIMEOUT", "SOURCE_HTTP_ERROR", "SOURCE_RUNTIME_ERROR",
  "SOURCE_RESPONSE_TOO_LARGE", "SOURCE_RESPONSE_INVALID", "SOURCE_UNREACHABLE"
] as const;

export const ahvazCarScoutSnapshotSchema = z.strictObject({
  runId: z.uuid(),
  scope: z.literal(AHVAZ_CAR_SCOUT_SCOPE),
  agent: z.literal("market-scout"),
  mode: z.literal("PUBLIC_DATA_RESEARCH_ONLY"),
  status: z.enum(["RUNNING", "COMPLETED", "EMPTY", "NO_ACCEPTED_ROWS", "FAILED"]),
  startedAt: timestamp,
  finishedAt: timestamp.nullable(),
  requestCount: z.number().int().min(0).max(1),
  sourceHttpStatus: z.number().int().min(100).max(599).nullable(),
  paidSpend: z.literal(0),
  failureCode: z.enum(CAR_SCOUT_FAILURE_CODES).nullable(),
  discovery: carScoutDiscoverySchema.nullable()
}).superRefine((run, context) => {
  const invalid = run.status === "RUNNING"
    ? run.finishedAt !== null || run.failureCode !== null || run.discovery !== null
    : run.finishedAt === null || (run.status === "FAILED"
      ? run.failureCode === null || run.discovery !== null
      : run.failureCode !== null || run.discovery === null || run.requestCount !== 1 ||
        run.sourceHttpStatus === null || run.sourceHttpStatus < 200 || run.sourceHttpStatus > 299 ||
        (run.status === "COMPLETED" && run.discovery.rows.length === 0) ||
        (run.status === "EMPTY" && run.discovery.elementsReturned !== 0) ||
        (run.status === "NO_ACCEPTED_ROWS" && (run.discovery.rows.length !== 0 || run.discovery.elementsReturned === 0)));
  if (invalid || (run.sourceHttpStatus !== null && run.requestCount !== 1) ||
      (run.finishedAt && run.finishedAt < run.startedAt) ||
      (run.discovery && (run.discovery.observedAt < run.startedAt || run.discovery.observedAt > run.finishedAt!))) {
    context.addIssue({ code: "custom", message: "Run status must match its recorded evidence" });
  }
});

export const ahvazCarScoutFeedSchema = z.strictObject({
  contractVersion: z.literal(AHVAZ_CAR_SCOUT_VERSION),
  persistence: z.literal("PROCESS_MEMORY"),
  snapshot: ahvazCarScoutSnapshotSchema.nullable()
});

export const ahvazCarScoutExecutionSchema = z.strictObject({
  contractVersion: z.literal(AHVAZ_CAR_SCOUT_VERSION),
  disposition: z.enum(["CREATED", "REUSED"]),
  snapshot: ahvazCarScoutSnapshotSchema
});

export type CarScoutObservation = z.infer<typeof carScoutObservationSchema>;
export type CarScoutDiscovery = z.infer<typeof carScoutDiscoverySchema>;
export type AhvazCarScoutSnapshot = z.infer<typeof ahvazCarScoutSnapshotSchema>;
export type AhvazCarScoutFeed = z.infer<typeof ahvazCarScoutFeedSchema>;
export type AhvazCarScoutExecution = z.infer<typeof ahvazCarScoutExecutionSchema>;

export interface AhvazCarScoutSource {
  discover(request: { signal: AbortSignal; onRequest: () => void; onResponse: (status: number) => void }): Promise<unknown>;
}
