import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  query: vi.fn(),
  ping: vi.fn(),
  cache: vi.fn(),
  locales: vi.fn()
}));
vi.mock("@/lib/container", () => ({ getDatabaseClient: () => state.query }));
vi.mock("@/lib/public-cache", () => ({
  getPublicCache: state.cache,
  cachedPublicLocales: state.locales
}));
import { GET as health } from "@/app/api/health/route";
import { GET as locales } from "@/app/api/public/locales/route";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://fixture@postgres/manovaflow");
  vi.stubEnv("REDIS_URL", "redis://redis:6379");
  vi.clearAllMocks();
  state.query.mockResolvedValue([{ "?column?": 1 }]);
  state.ping.mockResolvedValue("PONG");
  state.cache.mockResolvedValue({ ping: state.ping });
  state.locales.mockImplementation(async (load: () => unknown) => ({
    value: load(),
    cache: "MISS"
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe("Docker HTTP routes", () => {
  it("checks PostgreSQL and Redis before returning ready", async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(state.query).toHaveBeenCalled();
    expect(state.ping).toHaveBeenCalled();
  });
  it("returns 503 without leaking database errors", async () => {
    state.query.mockRejectedValueOnce(new Error("secret connection string"));
    const response = await health();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
  it("returns 503 if Redis is unavailable", async () => {
    state.ping.mockRejectedValueOnce(new Error("unreachable"));
    expect((await health()).status).toBe(503);
  });
  it("returns 503 for incomplete environment", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect((await health()).status).toBe(503);
    expect(state.query).not.toHaveBeenCalled();
  });
  it("serves the real public language options with cache status", async () => {
    const response = await locales();
    expect(response.headers.get("x-cache")).toBe("MISS");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(
      body.locales.map((option: { locale: string }) => option.locale)
    ).toEqual(["en", "fr", "ar"]);
  });
});
