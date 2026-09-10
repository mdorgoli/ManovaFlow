import { describe, expect, it, vi } from "vitest";
import { AHVAZ_CAR_OVERPASS_QUERY, OverpassAhvazCarSource, parseAhvazCarOverpassResponse } from "@/modules/growth/infrastructure/overpass-ahvaz-car-source";
import { carScoutDiscoverySchema, safeCarScoutWebsite } from "@/modules/growth/application/ahvaz-car-scout-contracts";

const observedAt = "2026-09-10T12:00:00.000Z";

// Synthetic parser fixtures only; none is loaded by the application.
function element(osmId: number, tags: Record<string, unknown> = {}) {
  return { type: "car_observation", id: 90000 + osmId, tags: {
    osm_id: String(osmId), osm_type: "node", name: "نمایشگاه نمونه آزمون", name_fa: "",
    category: "car", latitude: "31.32", longitude: "48.68", website: "", contact_website: "", ...tags
  } };
}
const parse = (elements: unknown[]) => parseAhvazCarOverpassResponse({ elements }, observedAt);

describe("Ahvaz car source: bounded public observations", () => {
  it("queries the fixed Ahvaz rectangle with no supplied names and no website requirement", () => {
    expect(AHVAZ_CAR_OVERPASS_QUERY).toContain('nwr(31.15,48.4,31.6,48.95)["shop"="car"]');
    expect(AHVAZ_CAR_OVERPASS_QUERY).toContain("[timeout:20][maxsize:33554432]");
    expect(AHVAZ_CAR_OVERPASS_QUERY).toContain("out tags 201;");
    expect(AHVAZ_CAR_OVERPASS_QUERY).toContain("osm_id=id(),osm_type=type()");
    expect(AHVAZ_CAR_OVERPASS_QUERY.split(";convert")[0]).not.toMatch(/\["(?:website|name)"\]/u);
    expect(AHVAZ_CAR_OVERPASS_QUERY).not.toMatch(/phone|email|contactName|تهران|serviceflow/iu);
  });

  it("retains records without websites and preserves OSM identity independently of domains", () => {
    const result = parse([
      element(1),
      element(2, { website: "https://www.example.com/showroom?tracking=1#map" }),
      element(3, { website: "https://www.example.com/showroom" }),
      element(1, { osm_type: "way", contact_website: "http://example.org/" }),
      element(4, { website: "javascript:alert(1)" })
    ]);
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]).toMatchObject({ observationId: "osm:node:1", osmId: 1, sourceUrl: "https://www.openstreetmap.org/node/1", website: { state: "NOT_RECORDED", url: null } });
    expect(result.rows[1]?.website).toEqual({ state: "RECORDED", url: "https://www.example.com/showroom", tag: "website" });
    expect(result.rows[3]).toMatchObject({ observationId: "osm:way:1", website: { state: "RECORDED", url: "http://example.org/", tag: "contact:website" } });
    expect(result.rows[4]?.website).toEqual({ state: "REJECTED_UNSAFE", url: null, tag: null });
    expect(JSON.stringify(result)).not.toMatch(/tracking|javascript|domain|phone|email|qualified|contactName/u);
  });

  it("rejects wrong category, out-of-area, duplicate identities and unexpected contact fields", () => {
    const result = parse([
      element(1), element(1), element(2, { category: "car_repair" }),
      element(3, { latitude: "35.7", longitude: "51.4" }),
      element(4, { phone: "fixture forbidden" }), element(5, { name: "تماس 09123456789" }),
      element(6, { name: "" }), element(7, { osm_id: "9007199254740992" }),
      element(8, { name: "", name_fa: "نام فارسی آزمون" })
    ]);
    expect(result.rows).toHaveLength(2);
    expect(result.rejections).toEqual({ INVALID_RECORD: 4, WRONG_CATEGORY: 1, OUTSIDE_BOUNDS: 1, DUPLICATE_OSM_ID: 1, OUTPUT_LIMIT: 0 });
    expect(JSON.stringify(result)).not.toContain("09123456789");
  });

  it("never turns a source runtime failure or malformed envelope into an empty result", () => {
    expect(() => parseAhvazCarOverpassResponse({ remark: "runtime error", elements: [] }, observedAt)).toThrow("OVERPASS_RUNTIME_ERROR");
    expect(() => parseAhvazCarOverpassResponse({}, observedAt)).toThrow("OVERPASS_RESPONSE_SCHEMA_INVALID");
    expect(parse([])).toMatchObject({ rows: [], elementsReturned: 0, limitReached: false });
  });

  it("marks truncation and keeps consistent counters at the output bound", () => {
    const result = parse(Array.from({ length: 201 }, (_, index) => element(index + 1)));
    expect(result).toMatchObject({ elementsReturned: 201, limitReached: true, rejections: { OUTPUT_LIMIT: 1 } });
    expect(result.rows).toHaveLength(200);
    expect(() => parse(Array.from({ length: 202 }, (_, index) => element(index + 1)))).toThrow();
  });

  it.each(["https://127.0.0.1/", "https://[::1]/", "https://2130706433/", "https://foo.local/", "http://localhost/", "https://user:secret@example.com/", "https://example.com:444/", "//example.com", "javascript:alert(1)", "https://example.com\\@127.0.0.1/", "https://user@example.com/"])("rejects unsafe reported link %s", (url) => {
    expect(safeCarScoutWebsite(url)).toBeNull();
  });

  it("fails read-model validation on invented source links, counters and contact fields", () => {
    const result = parse([element(1)]);
    expect(carScoutDiscoverySchema.safeParse({ ...result, elementsReturned: 0 }).success).toBe(false);
    expect(carScoutDiscoverySchema.safeParse({ ...result, rows: [{ ...result.rows[0], sourceUrl: "https://evil.example/" }] }).success).toBe(false);
    expect(carScoutDiscoverySchema.safeParse({ ...result, rows: [{ ...result.rows[0], contactName: "fixture" }] }).success).toBe(false);
  });

  it("performs exactly one read-only POST and records the request before HTTP failure", async () => {
    const onRequest = vi.fn();
    const fetchImpl = vi.fn(async () => new Response("unavailable", { status: 429 }));
    const onResponse = vi.fn();
    await expect(new OverpassAhvazCarSource(fetchImpl).discover({ signal: new AbortController().signal, onRequest, onResponse })).rejects.toThrow("OVERPASS_HTTP_429");
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledExactlyOnceWith(429);
    expect(fetchImpl).toHaveBeenCalledWith("https://overpass-api.de/api/interpreter", expect.objectContaining({ method: "POST", redirect: "error", cache: "no-store" }));
  });

  it("cancels oversized streaming bodies even without content-length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(260_000)); }, cancel
    });
    const source = new OverpassAhvazCarSource(vi.fn(async () => new Response(stream, { headers: { "content-type": "application/json" } })));
    await expect(source.discover({ signal: new AbortController().signal, onRequest: vi.fn(), onResponse: vi.fn() })).rejects.toThrow("OVERPASS_RESPONSE_TOO_LARGE");
    expect(cancel).toHaveBeenCalledOnce();
  });
});
