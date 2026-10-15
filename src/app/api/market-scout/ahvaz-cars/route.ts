import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { authorizeDashboard, authorizeResearchRun } from "@/lib/api-policy";
import { resolveRequestActor } from "@/lib/request-auth";
import { AHVAZ_CAR_SCOUT_SCOPE } from "@/modules/growth/application/ahvaz-car-scout-contracts";
import {
  AhvazCarScoutAdmissionError,
  getAhvazCarScoutExecutor
} from "@/modules/growth/application/ahvaz-car-scout-execution";
import { OverpassAhvazCarSource } from "@/modules/growth/infrastructure/overpass-ahvaz-car-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "cache-control": "private, no-store" };
const commandSchema = z.strictObject({
  scope: z.literal(AHVAZ_CAR_SCOUT_SCOPE)
});

export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return disabled();
  try {
    const actor = await resolveRequestActor(request);
    authorizeDashboard(actor, request.headers);
    return NextResponse.json(getAhvazCarScoutExecutor().read(actor), {
      headers
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") return disabled();
  try {
    const actor = await resolveRequestActor(request);
    const idempotencyKey = authorizeResearchRun(actor, request.headers);
    if (!hasValidLocalOrigin(request)) {
      return NextResponse.json(
        { error: { code: "SCOUT_ORIGIN_REJECTED" } },
        { status: 403, headers }
      );
    }
    if (
      request.headers.get("content-type")?.split(";")[0]?.trim() !==
      "application/json"
    ) {
      return NextResponse.json(
        { error: { code: "SCOUT_JSON_REQUIRED" } },
        { status: 415, headers }
      );
    }
    // Bound the body while reading, including chunked requests without a length.
    if (!request.body) throw new Error("SCOUT_COMMAND_REQUIRED");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 256) {
          await reader.cancel();
          return NextResponse.json(
            { error: { code: "SCOUT_COMMAND_TOO_LARGE" } },
            { status: 413, headers }
          );
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    commandSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await getAhvazCarScoutExecutor().execute({
      actor,
      idempotencyKey,
      source: new OverpassAhvazCarSource()
    });
    return NextResponse.json(result, {
      status: result.disposition === "CREATED" ? 201 : 200,
      headers
    });
  } catch (error) {
    return failure(error);
  }
}

function disabled() {
  return NextResponse.json(
    { error: { code: "AHVAZ_SCOUT_LOCAL_ONLY" } },
    { status: 503, headers }
  );
}

function hasValidLocalOrigin(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const internalUrl = new URL(request.url);
  // NextURL normalizes 127.0.0.1/[::1] to localhost. The browser's actual
  // destination remains in Host. Never use an untrusted forwarded-host header.
  const host = request.headers.get("host") ?? internalUrl.host;
  if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::[1-9]\d{0,4})?$/iu.test(host))
    return false;
  if (!["http:", "https:"].includes(internalUrl.protocol)) return false;
  try {
    const expectedOrigin = new URL(`${internalUrl.protocol}//${host}`).origin;
    const origin = request.headers.get("origin");
    // Scripted local clients may omit Origin; JSON + a fixed custom header are
    // still mandatory. Browser cross-site and opaque origins remain rejected.
    return origin === null || origin === expectedOrigin;
  } catch {
    return false;
  }
}

function failure(error: unknown): NextResponse {
  if (error instanceof AhvazCarScoutAdmissionError) {
    return NextResponse.json(
      { error: { code: error.code } },
      { status: error.code === "SCOUT_KEY_INVALID" ? 400 : 429, headers }
    );
  }
  const response =
    error instanceof SyntaxError
      ? NextResponse.json(
          { error: { code: "SCOUT_COMMAND_INVALID" } },
          { status: 400 }
        )
      : apiError(error);
  response.headers.set("cache-control", "private, no-store");
  return response;
}
