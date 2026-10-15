import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ActorContext } from "@/modules/growth/domain/types";
import type { AhvazCarScoutExecutor } from "@/modules/growth/application/ahvaz-car-scout-execution";

const state = vi.hoisted(() => ({
  executor: undefined as AhvazCarScoutExecutor | undefined,
  actor: {
    tenantId: "10000000-0000-4000-8000-000000000001",
    actorId: "20000000-0000-4000-8000-000000000001",
    role: "OWNER"
  } as ActorContext
}));
vi.mock("@/lib/request-auth", () => ({
  resolveRequestActor: async () => structuredClone(state.actor)
}));
vi.mock(
  "@/modules/growth/application/ahvaz-car-scout-execution",
  async (importOriginal) => {
    const implementation =
      await importOriginal<
        typeof import("@/modules/growth/application/ahvaz-car-scout-execution")
      >();
    return {
      ...implementation,
      getAhvazCarScoutExecutor: () => state.executor!
    };
  }
);

import { AhvazCarScoutExecutor as Executor } from "@/modules/growth/application/ahvaz-car-scout-execution";
import { GET, POST } from "@/app/api/market-scout/ahvaz-cars/route";

beforeEach(() => {
  vi.unstubAllEnvs();
  state.executor = new Executor();
  state.actor.role = "OWNER";
  state.actor.tenantId = "10000000-0000-4000-8000-000000000001";
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ elements: [] }), {
          headers: { "content-type": "application/json" }
        })
    )
  );
});

function command(
  body: unknown = { scope: "AHVAZ-CAR-SCOUT-1" },
  headers: Record<string, string> = {}
) {
  return new Request("http://127.0.0.1:3000/api/market-scout/ahvaz-cars", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "ahvaz-car-scout-1-osm-v1",
      ...headers
    },
    body: JSON.stringify(body)
  });
}
const read = () =>
  GET(new Request("http://127.0.0.1:3000/api/market-scout/ahvaz-cars"));

describe("Ahvaz scout API authorization and real execution contract", () => {
  it("GET is read-only; POST executes once; repeated POST and GET return the same run", async () => {
    expect(await (await read()).json()).toMatchObject({
      persistence: "PROCESS_MEMORY",
      snapshot: null
    });
    expect(fetch).not.toHaveBeenCalled();
    const first = await POST(command());
    expect(first.status).toBe(201);
    const result = await first.json();
    expect(result).toMatchObject({
      disposition: "CREATED",
      snapshot: {
        scope: "AHVAZ-CAR-SCOUT-1",
        status: "EMPTY",
        requestCount: 1,
        sourceHttpStatus: 200,
        paidSpend: 0
      }
    });
    const repeat = await POST(command());
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toMatchObject({
      disposition: "REUSED",
      snapshot: { runId: result.snapshot.runId }
    });
    const feed = await read();
    expect(feed.headers.get("cache-control")).toBe("private, no-store");
    expect(await feed.json()).toMatchObject({
      snapshot: { runId: result.snapshot.runId }
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([
    { scope: "SF-DEMO-1B" },
    { scope: "AHVAZ-CAR-SCOUT-1", tenantId: "fake" },
    { scope: "AHVAZ-CAR-SCOUT-1", candidates: [{ name: "injected fixture" }] },
    { scope: "AHVAZ-CAR-SCOUT-1", city: "Tehran" }
  ])("rejects injected discovery or scope changes: %j", async (body) => {
    expect((await POST(command(body))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects wrong keys, client identity, cross-origin, oversized and non-JSON commands", async () => {
    expect(
      (await POST(command(undefined, { "idempotency-key": "another-key" })))
        .status
    ).toBe(400);
    expect(
      (await POST(command(undefined, { "x-tenant-id": state.actor.tenantId })))
        .status
    ).toBe(400);
    expect(
      (await POST(command(undefined, { origin: "https://attacker.example" })))
        .status
    ).toBe(403);
    expect(
      (await POST(command(undefined, { "sec-fetch-site": "cross-site" })))
        .status
    ).toBe(403);
    expect(
      (await POST(command(undefined, { "content-type": "text/plain" }))).status
    ).toBe(415);
    expect(
      (
        await POST(
          command({ scope: "AHVAZ-CAR-SCOUT-1", padding: "x".repeat(300) })
        )
      ).status
    ).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires research capability and never exposes another tenant's run", async () => {
    await POST(command());
    state.actor.tenantId = "10000000-0000-4000-8000-000000000002";
    expect(await (await read()).json()).toMatchObject({ snapshot: null });
    state.actor.role = "VIEWER";
    expect((await POST(command())).status).toBe(403);
    expect((await read()).status).toBe(200);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(["127.0.0.1:3000", "localhost:3000", "[::1]:3000"])(
    "uses real Host for %s despite NextURL loopback normalization",
    async (host) => {
      const request = new NextRequest(
        `http://${host}/api/market-scout/ahvaz-cars`,
        {
          method: "POST",
          headers: {
            host,
            origin: `http://${host}`,
            "sec-fetch-site": "same-origin",
            "content-type": "application/json",
            "idempotency-key": "ahvaz-car-scout-1-osm-v1"
          },
          body: '{"scope":"INVALID-LOCAL-PREFLIGHT"}'
        }
      );
      expect(new URL(request.url).hostname).toBe("localhost");
      const response = await POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" }
      });
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each([
    { host: "127.0.0.1:3000", origin: "http://localhost:3000" },
    { host: "127.0.0.1:3000", origin: "http://127.0.0.1:4000" },
    { host: "127.0.0.1:3000", origin: "https://127.0.0.1:3000" },
    { host: "127.0.0.1:3000", origin: "null" },
    { host: "attacker.example", origin: "http://attacker.example" },
    {
      host: "127.0.0.1:3000,attacker.example",
      origin: "http://127.0.0.1:3000"
    },
    {
      host: "127.0.0.1:3000",
      origin: "http://attacker.example",
      "x-forwarded-host": "attacker.example"
    }
  ])("retains exact origin checks with headers %j", async (headers) => {
    const request = new NextRequest(
      "http://127.0.0.1:3000/api/market-scout/ahvaz-cars",
      {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "idempotency-key": "ahvaz-car-scout-1-osm-v1"
        },
        body: '{"scope":"AHVAZ-CAR-SCOUT-1"}'
      }
    );
    expect((await POST(request)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports upstream failure with no claimed empty discovery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fixture network error with private detail");
      })
    );
    const response = await POST(command());
    const result = await response.json();
    expect(result.snapshot).toMatchObject({
      status: "FAILED",
      requestCount: 1,
      failureCode: "SOURCE_UNREACHABLE",
      sourceHttpStatus: null,
      discovery: null
    });
    expect(JSON.stringify(result)).not.toContain("private detail");
  });

  it("disables both execution and local reports in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(command())).status).toBe(503);
    expect((await read()).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
