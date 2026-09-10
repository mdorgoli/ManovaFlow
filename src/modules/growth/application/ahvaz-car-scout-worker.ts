import {
  AHVAZ_CAR_SCOUT_BUDGET,
  ahvazCarScoutSnapshotSchema,
  carScoutDiscoverySchema,
  type AhvazCarScoutSnapshot,
  type AhvazCarScoutSource
} from "./ahvaz-car-scout-contracts";

/** Executes public-data discovery only. No candidate qualification or outreach. */
export async function runAhvazCarScoutWorker(input: {
  initial: AhvazCarScoutSnapshot;
  source: AhvazCarScoutSource;
  onRequest: (count: number) => void;
  onResponse: (status: number) => void;
}): Promise<AhvazCarScoutSnapshot> {
  const controller = new AbortController();
  let requestCount = 0;
  let sourceHttpStatus: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  try {
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("AHVAZ_SOURCE_TIMEOUT"));
      }, AHVAZ_CAR_SCOUT_BUDGET.maxElapsedMs);
    });
    const raw = await Promise.race([
      input.source.discover({
        signal: controller.signal,
        onRequest: () => {
          if (closed || controller.signal.aborted || requestCount >= AHVAZ_CAR_SCOUT_BUDGET.maxRequests) {
            throw new Error("AHVAZ_SOURCE_REQUEST_BUDGET_EXCEEDED");
          }
          requestCount++;
          input.onRequest(requestCount);
        },
        onResponse: (status) => {
          if (closed || controller.signal.aborted || requestCount !== 1 || sourceHttpStatus !== null ||
              !Number.isInteger(status) || status < 100 || status > 599) {
            throw new Error("AHVAZ_SOURCE_HTTP_EVIDENCE_INVALID");
          }
          sourceHttpStatus = status;
          input.onResponse(status);
        }
      }),
      timedOut
    ]);
    if (requestCount !== 1) throw new Error("AHVAZ_SOURCE_REQUEST_NOT_RECORDED");
    const discovery = carScoutDiscoverySchema.parse(raw);
    return ahvazCarScoutSnapshotSchema.parse({
      ...input.initial,
      requestCount,
      sourceHttpStatus,
      finishedAt: new Date().toISOString(),
      status: discovery.rows.length > 0 ? "COMPLETED" : discovery.elementsReturned === 0 ? "EMPTY" : "NO_ACCEPTED_ROWS",
      discovery
    });
  } catch (error) {
    return ahvazCarScoutSnapshotSchema.parse({
      ...input.initial,
      status: "FAILED",
      requestCount,
      sourceHttpStatus,
      finishedAt: new Date().toISOString(),
      failureCode: failureCode(error),
      discovery: null
    });
  } finally {
    closed = true;
    controller.abort();
    if (timer) clearTimeout(timer);
  }
}

function failureCode(error: unknown): NonNullable<AhvazCarScoutSnapshot["failureCode"]> {
  const code = error instanceof Error ? error.message : "";
  if (code === "AHVAZ_SOURCE_TIMEOUT") return "SOURCE_TIMEOUT";
  if (/^OVERPASS_HTTP_\d{3}$/u.test(code)) return "SOURCE_HTTP_ERROR";
  if (code === "OVERPASS_RUNTIME_ERROR") return "SOURCE_RUNTIME_ERROR";
  if (code === "OVERPASS_RESPONSE_TOO_LARGE") return "SOURCE_RESPONSE_TOO_LARGE";
  if (code.startsWith("OVERPASS_RESPONSE_") || code.startsWith("AHVAZ_SOURCE_") ||
      (error instanceof Error && error.name === "ZodError")) return "SOURCE_RESPONSE_INVALID";
  return "SOURCE_UNREACHABLE";
}
