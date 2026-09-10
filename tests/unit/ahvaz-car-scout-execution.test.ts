import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@/modules/growth/domain/types";
import { AhvazCarScoutExecutor } from "@/modules/growth/application/ahvaz-car-scout-execution";
import { AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY, type AhvazCarScoutSource } from "@/modules/growth/application/ahvaz-car-scout-contracts";
import { OverpassAhvazCarSource, parseAhvazCarOverpassResponse } from "@/modules/growth/infrastructure/overpass-ahvaz-car-source";

const actor: ActorContext = { tenantId: "10000000-0000-4000-8000-000000000001", actorId: "20000000-0000-4000-8000-000000000001", role: "OWNER" };
const otherActor: ActorContext = { ...actor, tenantId: "10000000-0000-4000-8000-000000000002" };
const idempotencyKey = AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY;
const empty = () => parseAhvazCarOverpassResponse({ elements: [] }, new Date().toISOString());
const source = () => ({ discover: vi.fn(async ({ onRequest, onResponse }: Parameters<AhvazCarScoutSource["discover"]>[0]) => { onRequest(); onResponse(200); return empty(); }) });
afterEach(() => vi.useRealTimers());

describe("Ahvaz car worker and tenant-scoped admission", () => {
  it("coalesces concurrent commands and exposes only the requesting tenant's snapshot", async () => {
    const executor = new AhvazCarScoutExecutor();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const adapter = { discover: vi.fn(async ({ onRequest, onResponse }: Parameters<AhvazCarScoutSource["discover"]>[0]) => { onRequest(); await gate; onResponse(200); return empty(); }) };
    const first = executor.execute({ actor, idempotencyKey, source: adapter });
    const duplicate = executor.execute({ actor, idempotencyKey, source: adapter });
    await vi.waitFor(() => expect(adapter.discover).toHaveBeenCalledOnce());
    expect(executor.read(actor).snapshot).toMatchObject({ status: "RUNNING", requestCount: 1 });
    expect(executor.read(otherActor).snapshot).toBeNull();
    await expect(executor.execute({ actor: otherActor, idempotencyKey, source: adapter })).rejects.toThrow("SCOUT_BUSY");
    release();
    const [created, reused] = await Promise.all([first, duplicate]);
    expect(created).toMatchObject({ disposition: "CREATED", snapshot: { status: "EMPTY", requestCount: 1, sourceHttpStatus: 200, failureCode: null } });
    expect(reused.disposition).toBe("REUSED");
    expect(reused.snapshot.runId).toBe(created.snapshot.runId);
    expect(adapter.discover).toHaveBeenCalledOnce();
  });

  it("records source failure separately from empty and never retries a failed key", async () => {
    const executor = new AhvazCarScoutExecutor();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ remark: "runtime error: timeout", elements: [] }), { headers: { "content-type": "application/json" } }));
    const adapter = new OverpassAhvazCarSource(fetchImpl);
    const first = await executor.execute({ actor, idempotencyKey, source: adapter });
    const second = await executor.execute({ actor, idempotencyKey, source: adapter });
    expect(first.snapshot).toMatchObject({ status: "FAILED", failureCode: "SOURCE_RUNTIME_ERROR", discovery: null, requestCount: 1, sourceHttpStatus: 200 });
    expect(second.disposition).toBe("REUSED");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("keeps tenant executions separate and returned snapshots cannot mutate storage", async () => {
    const executor = new AhvazCarScoutExecutor();
    const adapter = source();
    const first = await executor.execute({ actor, idempotencyKey, source: adapter });
    const second = await executor.execute({ actor: otherActor, idempotencyKey, source: adapter });
    expect(first.snapshot.runId).not.toBe(second.snapshot.runId);
    first.snapshot.status = "FAILED";
    expect(executor.read(actor).snapshot?.status).toBe("EMPTY");
    expect(executor.read(otherActor).snapshot?.runId).toBe(second.snapshot.runId);
    expect(adapter.discover).toHaveBeenCalledTimes(2);
  });

  it("rejects viewer, invalid identity and changing the task key before source access", async () => {
    const executor = new AhvazCarScoutExecutor();
    const adapter = source();
    await expect(executor.execute({ actor: { ...actor, role: "VIEWER" }, idempotencyKey, source: adapter })).rejects.toThrow("RUN_RESEARCH");
    await expect(executor.execute({ actor: { ...actor, tenantId: "spoof" }, idempotencyKey, source: adapter })).rejects.toThrow();
    await expect(executor.execute({ actor, idempotencyKey: "another-key", source: adapter })).rejects.toThrow("SCOUT_KEY_INVALID");
    expect(adapter.discover).not.toHaveBeenCalled();
    expect(executor.read({ ...actor, role: "VIEWER" }).snapshot).toBeNull();
  });

  it("times out even when a source ignores abort and prevents late extra requests", async () => {
    vi.useFakeTimers();
    const executor = new AhvazCarScoutExecutor();
    let captured: Parameters<AhvazCarScoutSource["discover"]>[0] | undefined;
    const adapter = { discover: vi.fn((request: Parameters<AhvazCarScoutSource["discover"]>[0]) => { captured = request; request.onRequest(); return new Promise<unknown>(() => undefined); }) };
    const operation = executor.execute({ actor, idempotencyKey, source: adapter });
    await vi.advanceTimersByTimeAsync(30_001);
    expect((await operation).snapshot).toMatchObject({ status: "FAILED", failureCode: "SOURCE_TIMEOUT", requestCount: 1, discovery: null });
    expect(captured?.signal.aborted).toBe(true);
    expect(() => captured?.onRequest()).toThrow("AHVAZ_SOURCE_REQUEST_BUDGET_EXCEEDED");
    expect((await executor.execute({ actor, idempotencyKey, source: adapter })).disposition).toBe("REUSED");
    expect(adapter.discover).toHaveBeenCalledOnce();
  });

  it("rejects claimed discovery without actual request accounting and enforces the request cap", async () => {
    const absent = await new AhvazCarScoutExecutor().execute({ actor, idempotencyKey, source: { discover: async () => empty() } });
    expect(absent.snapshot).toMatchObject({ status: "FAILED", failureCode: "SOURCE_RESPONSE_INVALID", requestCount: 0 });
    const excess = await new AhvazCarScoutExecutor().execute({ actor, idempotencyKey, source: { discover: async ({ onRequest }) => { onRequest(); onRequest(); return empty(); } } });
    expect(excess.snapshot).toMatchObject({ status: "FAILED", failureCode: "SOURCE_RESPONSE_INVALID", requestCount: 1 });
  });

  it("keeps malformed returned records distinct from a genuinely empty source", async () => {
    const adapter = { discover: async ({ onRequest, onResponse }: Parameters<AhvazCarScoutSource["discover"]>[0]) => {
      onRequest(); onResponse(200); return parseAhvazCarOverpassResponse({ elements: [{ invalid: "fixture" }] }, new Date().toISOString());
    } };
    const result = await new AhvazCarScoutExecutor().execute({ actor, idempotencyKey, source: adapter });
    expect(result.snapshot).toMatchObject({ status: "NO_ACCEPTED_ROWS", discovery: { elementsReturned: 1, rows: [], rejections: { INVALID_RECORD: 1 } } });
  });
});
