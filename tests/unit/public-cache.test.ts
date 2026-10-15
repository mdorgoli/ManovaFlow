import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  client: { isReady: true, connect: vi.fn(), on: vi.fn(), get: vi.fn(), set: vi.fn() }
}));
vi.mock("redis", () => ({ createClient: () => state.client }));
import { cachedPublicLocales } from "@/lib/public-cache";

beforeEach(() => {
  delete (globalThis as typeof globalThis & { manovaPublicRedis?: unknown }).manovaPublicRedis;
  vi.stubEnv("REDIS_URL", "redis://redis:6379");
  vi.clearAllMocks();
  state.client.connect.mockResolvedValue(state.client);
  state.client.get.mockResolvedValue(null);
  state.client.set.mockResolvedValue("OK");
});
afterEach(() => vi.unstubAllEnvs());

describe("public Redis cache", () => {
  it("fills a cache miss with a 60-second expiry", async () => {
    expect(await cachedPublicLocales(() => ["en", "fr", "ar"])).toEqual({
      value: ["en", "fr", "ar"], cache: "MISS"
    });
    expect(state.client.set).toHaveBeenCalledWith(
      "manovaflow:public:locales:v1", '["en","fr","ar"]', { EX: 60 }
    );
  });
  it("serves a hit without reloading data", async () => {
    state.client.get.mockResolvedValue('["en"]');
    const load = vi.fn(() => ["fr"]);
    expect(await cachedPublicLocales(load)).toEqual({ value: ["en"], cache: "HIT" });
    expect(load).not.toHaveBeenCalled();
  });
  it("bypasses Redis when no URL is configured", async () => {
    vi.stubEnv("REDIS_URL", "");
    expect(await cachedPublicLocales(() => ["en"])).toEqual({ value: ["en"], cache: "BYPASS" });
    expect(state.client.connect).not.toHaveBeenCalled();
  });
  it("keeps public data available on connection failure and retries later", async () => {
    state.client.connect.mockRejectedValueOnce(new Error("unreachable"));
    expect((await cachedPublicLocales(() => ["en"])).cache).toBe("BYPASS");
    expect((await cachedPublicLocales(() => ["en"])).cache).toBe("MISS");
  });
  it("falls back on malformed cached JSON", async () => {
    state.client.get.mockResolvedValue("not JSON");
    expect(await cachedPublicLocales(() => ["ar"])).toEqual({ value: ["ar"], cache: "BYPASS" });
  });
  it("falls back if a cache write fails", async () => {
    state.client.set.mockRejectedValueOnce(new Error("unreachable"));
    expect((await cachedPublicLocales(() => ["en"])).cache).toBe("BYPASS");
  });
});
