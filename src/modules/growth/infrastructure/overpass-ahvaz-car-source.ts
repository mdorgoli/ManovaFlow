import { z } from "zod";
import {
  AHVAZ_CAR_SCOUT_BBOX,
  AHVAZ_CAR_SCOUT_BUDGET,
  carScoutDiscoverySchema,
  carScoutNameSchema,
  safeCarScoutWebsite,
  type AhvazCarScoutSource,
  type CarScoutDiscovery,
  type CarScoutObservation
} from "../application/ahvaz-car-scout-contracts";
import { fetchOverpassJson } from "./overpass-transport";

// Only selected public business fields leave Overpass; phone/email/person tags
// are deliberately absent. Website presence is never a discovery requirement.
export const AHVAZ_CAR_OVERPASS_QUERY =
  `[out:json][timeout:20][maxsize:33554432];` +
  `nwr(${AHVAZ_CAR_SCOUT_BBOX.join(",")})["shop"="car"];` +
  `convert car_observation osm_id=id(),osm_type=type(),name=t["name"],name_fa=t["name:fa"],` +
  `category=t["shop"],latitude=lat(),longitude=lon(),website=t["website"],contact_website=t["contact:website"];` +
  `out tags ${AHVAZ_CAR_SCOUT_BUDGET.maxRows + 1};`;

const envelopeSchema = z.object({
  osm3s: z.object({ timestamp_osm_base: z.string().optional() }).optional(),
  remark: z.string().optional(),
  elements: z.array(z.unknown()).max(AHVAZ_CAR_SCOUT_BUDGET.maxRows + 1)
});
const coordinate = z.string().regex(/^-?\d+(?:\.\d+)?$/u).transform(Number);
const elementSchema = z.strictObject({
  type: z.literal("car_observation"),
  id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  tags: z.strictObject({
    osm_id: z.string().regex(/^[1-9]\d{0,15}$/u).transform(Number).refine(Number.isSafeInteger),
    osm_type: z.enum(["node", "way", "relation"]),
    name: z.string().max(1000).optional(),
    name_fa: z.string().max(1000).optional(),
    category: z.string().max(80),
    latitude: coordinate,
    longitude: coordinate,
    website: z.string().max(8192).optional(),
    contact_website: z.string().max(8192).optional()
  })
});

export class OverpassAhvazCarSource implements AhvazCarScoutSource {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async discover(request: Parameters<AhvazCarScoutSource["discover"]>[0]): Promise<CarScoutDiscovery> {
    const json = await fetchOverpassJson({
      query: AHVAZ_CAR_OVERPASS_QUERY,
      signal: request.signal,
      fetchImpl: this.fetchImpl,
      onRequest: request.onRequest,
      onResponse: request.onResponse
    });
    return parseAhvazCarOverpassResponse(json, new Date().toISOString());
  }
}

export function parseAhvazCarOverpassResponse(input: unknown, observedAt: string): CarScoutDiscovery {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) throw new Error("OVERPASS_RESPONSE_SCHEMA_INVALID");
  if (parsed.data.remark?.trim()) throw new Error("OVERPASS_RUNTIME_ERROR");
  const rows: CarScoutObservation[] = [];
  const rejections = { INVALID_RECORD: 0, WRONG_CATEGORY: 0, OUTSIDE_BOUNDS: 0, DUPLICATE_OSM_ID: 0, OUTPUT_LIMIT: 0 };
  const seen = new Set<string>();
  for (const [index, raw] of parsed.data.elements.entries()) {
    if (index >= AHVAZ_CAR_SCOUT_BUDGET.maxRows) { rejections.OUTPUT_LIMIT++; continue; }
    const element = elementSchema.safeParse(raw);
    if (!element.success) { rejections.INVALID_RECORD++; continue; }
    const { tags } = element.data;
    // Derived Overpass ids are not OSM ids. Keep the original type + id pair.
    const id = tags.osm_id;
    if (tags.category !== "car") { rejections.WRONG_CATEGORY++; continue; }
    if (tags.latitude < AHVAZ_CAR_SCOUT_BBOX[0] || tags.latitude > AHVAZ_CAR_SCOUT_BBOX[2] ||
        tags.longitude < AHVAZ_CAR_SCOUT_BBOX[1] || tags.longitude > AHVAZ_CAR_SCOUT_BBOX[3]) {
      rejections.OUTSIDE_BOUNDS++; continue;
    }
    const name = carScoutNameSchema.safeParse(tags.name_fa?.trim() || tags.name?.trim());
    if (!name.success) { rejections.INVALID_RECORD++; continue; }
    const observationId = `osm:${tags.osm_type}:${id}`;
    if (seen.has(observationId)) { rejections.DUPLICATE_OSM_ID++; continue; }
    seen.add(observationId);
    const website = reportedWebsite(tags);
    rows.push({
      osmType: tags.osm_type,
      osmId: id,
      observationId,
      name: name.data,
      latitude: tags.latitude,
      longitude: tags.longitude,
      category: "shop=car",
      sourceUrl: `https://www.openstreetmap.org/${tags.osm_type}/${id}`,
      observedAt,
      website
    });
  }
  const base = parsed.data.osm3s?.timestamp_osm_base;
  const sourceSnapshotAt = base && Number.isFinite(Date.parse(base)) ? new Date(base).toISOString() : null;
  return carScoutDiscoverySchema.parse({
    observedAt,
    sourceSnapshotAt,
    elementsReturned: parsed.data.elements.length,
    limitReached: parsed.data.elements.length > AHVAZ_CAR_SCOUT_BUDGET.maxRows,
    rejections,
    rows
  });
}

function reportedWebsite(tags: { website?: string | undefined; contact_website?: string | undefined }): CarScoutObservation["website"] {
  for (const [tag, value] of [["website", tags.website], ["contact:website", tags.contact_website]] as const) {
    const url = value ? safeCarScoutWebsite(value) : null;
    if (url) return { state: "RECORDED", url, tag };
  }
  return {
    state: tags.website?.trim() || tags.contact_website?.trim() ? "REJECTED_UNSAFE" : "NOT_RECORDED",
    url: null,
    tag: null
  };
}
