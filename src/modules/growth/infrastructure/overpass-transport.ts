export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const OVERPASS_USER_AGENT = "ManovaFlow-MarketScout/0.1";
export const OVERPASS_MAX_RESPONSE_BYTES = 512_000;

/** A read-only Overpass query. Never follows redirects or fetches result URLs. */
export async function fetchOverpassJson(input: {
  query: string;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
  onRequest?: () => void;
  onResponse?: (status: number) => void;
}): Promise<unknown> {
  input.signal.throwIfAborted();
  input.onRequest?.();
  const response = await input.fetchImpl(OVERPASS_ENDPOINT, {
    method: "POST",
    redirect: "error",
    cache: "no-store",
    signal: input.signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": OVERPASS_USER_AGENT
    },
    body: new URLSearchParams({ data: input.query }).toString()
  });
  input.onResponse?.(response.status);
  const length = Number(response.headers.get("content-length") ?? "0");
  const contentType = response.headers.get("content-type") ?? "";
  const failure = !response.ok ? "OVERPASS_HTTP_" + response.status
    : length > OVERPASS_MAX_RESPONSE_BYTES ? "OVERPASS_RESPONSE_TOO_LARGE"
      : !contentType.toLowerCase().includes("application/json") ? "OVERPASS_RESPONSE_CONTENT_TYPE_INVALID"
        : !response.body ? "OVERPASS_RESPONSE_BODY_MISSING" : null;
  if (failure) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(failure);
  }

  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      input.signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > OVERPASS_MAX_RESPONSE_BYTES) throw new Error("OVERPASS_RESPONSE_TOO_LARGE");
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  let json: unknown;
  try {
    json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("OVERPASS_RESPONSE_JSON_INVALID");
  }
  // Overpass can return HTTP 200 with a runtime error and partial/empty elements.
  if (json && typeof json === "object" && "remark" in json && json.remark) {
    throw new Error("OVERPASS_RUNTIME_ERROR");
  }
  return json;
}
