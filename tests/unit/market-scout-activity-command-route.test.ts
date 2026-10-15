import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/modules/growth/domain/types";
import type { GrowthRepository } from "@/modules/growth/application/repository";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";

const state = vi.hoisted(() => ({
  repository: null as unknown as GrowthRepository,
  actor: {
    tenantId: "10000000-0000-4000-8000-000000000001",
    actorId: "20000000-0000-4000-8000-000000000001",
    role: "OWNER"
  } as ActorContext
}));

vi.mock("@/lib/container", () => ({
  getGrowthRepository: () => state.repository
}));

vi.mock("@/lib/request-auth", () => ({
  resolveRequestActor: async () => structuredClone(state.actor)
}));

import * as activityRoute from "@/app/api/market-scout/activity/route";

type PostHandler = (request: Request) => Promise<Response>;

beforeEach(() => {
  state.repository = new InMemoryGrowthRepository();
  vi.unstubAllEnvs();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": "15"
          }
        })
    )
  );
});

describe("POST /api/market-scout/activity", () => {
  it("runs the fixed Paris ServiceFlow pilot once and makes its snapshot readable", async () => {
    const post = (activityRoute as { POST?: PostHandler }).POST;
    expect(post).toBeTypeOf("function");
    if (!post) return;

    const first = await post(commandRequest());
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({
      contractVersion: "manovaflow.market-scout.execution.v1",
      disposition: "CREATED",
      scope: {
        id: "SF-DEMO-1B",
        countryCode: "FR",
        laneKey: "serviceflow"
      },
      snapshot: {
        contractVersion: "manovaflow.market-scout.activity.v1",
        agent: "market-scout",
        status: "COMPLETED",
        query: {
          origin: "SEARCH",
          countryCode: "FR",
          laneKey: "serviceflow"
        }
      }
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    const second = await post(commandRequest());
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ disposition: "REUSED" });
    expect(fetch).toHaveBeenCalledTimes(1);

    const read = await activityRoute.GET(
      new Request("https://app.example.test/api/market-scout/activity")
    );
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      state: "READY",
      snapshot: {
        query: { countryCode: "FR", laneKey: "serviceflow" }
      }
    });
  });

  it("rejects any scope other than SF-DEMO-1B before network access", async () => {
    const post = (activityRoute as { POST?: PostHandler }).POST;
    expect(post).toBeTypeOf("function");
    if (!post) return;

    const response = await post(commandRequest({ scope: "AE-DEMO" }));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a non-scope idempotency key before network access", async () => {
    const post = (activityRoute as { POST?: PostHandler }).POST;
    expect(post).toBeTypeOf("function");
    if (!post) return;

    const response = await post(
      commandRequest({ scope: "SF-DEMO-1B" }, "another-run")
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("coalesces concurrent commands into one bounded network execution", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        await gate;
        return new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );
    const post = (activityRoute as { POST?: PostHandler }).POST;
    expect(post).toBeTypeOf("function");
    if (!post) return;

    const first = post(commandRequest());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const second = post(commandRequest());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetch).toHaveBeenCalledTimes(1);
    release?.();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toMatchObject({
      disposition: "REUSED"
    });
  });

  it("keeps the live command disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const post = (activityRoute as { POST?: PostHandler }).POST;
    expect(post).toBeTypeOf("function");
    if (!post) return;

    const response = await post(commandRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "MARKET_SCOUT_DEMO_DISABLED",
        message: "Market Scout live demo execution is disabled in production"
      }
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

function commandRequest(
  body: unknown = { scope: "SF-DEMO-1B" },
  idempotencyKey = "sf-demo-1b-live-pilot-v1"
): Request {
  return new Request("https://app.example.test/api/market-scout/activity", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey
    },
    body: JSON.stringify(body)
  });
}
