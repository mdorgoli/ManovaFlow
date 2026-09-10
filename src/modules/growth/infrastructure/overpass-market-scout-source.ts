import { isIP } from "node:net";
import { z } from "zod";
import type {
  MarketScoutDiscoveryRequest,
  MarketScoutSource
} from "../application/market-scout-contracts";
import type { LaneKey, MarketKey } from "../domain/types";
import {
  fetchOverpassJson,
  OVERPASS_ENDPOINT,
  OVERPASS_MAX_RESPONSE_BYTES as MAX_RESPONSE_BYTES,
  OVERPASS_USER_AGENT as USER_AGENT
} from "./overpass-transport";

const OVERPASS_QUERY_MEMORY_BYTES = 16_777_216;

const marketSamples = Object.freeze({
  "fr-france": { countryCode: "FR", bbox: [48.8476, 2.3385, 48.8656, 2.3663], label: "Central Paris ~1 km bounding-box sample; not representative of all France" },
  "tr-istanbul": { countryCode: "TR", bbox: [40.9992, 28.9664, 41.0172, 28.9904], label: "Central Istanbul ~1 km bounding-box sample" },
  "iq-kri-erbil": { countryCode: "IQ", bbox: [36.1821, 43.9981, 36.2001, 44.0203], label: "Central Erbil ~1 km bounding-box sample; not representative of all Iraq" },
  "ae-dubai": { countryCode: "AE", bbox: [25.1958, 55.2609, 25.2138, 55.2807], label: "Central Dubai ~1 km bounding-box sample; not representative of all UAE" },
  "ir-tehran": { countryCode: "IR", bbox: [35.68, 51.36, 35.75, 51.45], label: "Central Tehran bounded sample (35.68,51.36–35.75,51.45); not representative of all Iran" }
} satisfies Record<MarketKey, MarketSample>);

const laneSelectors = Object.freeze({
  serviceflow: { tag: "craft", values: ["air_conditioning", "electrician", "heating_engineer", "hvac", "locksmith", "plumber"] },
  beautyflow: { tag: "shop", values: ["beauty", "hairdresser", "nail_salon"] },
  briefflow: { tag: "office", values: ["advertising_agency", "graphic_design", "web_design"] }
} satisfies Record<LaneKey, LaneSelector>);

const overpassResponseSchema = z.object({
  elements: z.array(z.object({
    type: z.literal("candidate"),
    id: z.number().int().nonnegative(),
    tags: z.strictObject({
      osm_type: z.enum(["node", "way", "relation"]),
      name: z.string(),
      website: z.string(),
      category: z.string(),
      opening_hours: z.string().optional()
    }).optional()
  }))
});

interface MarketSample {
  countryCode: string;
  bbox: readonly [number, number, number, number];
  label: string;
}

interface LaneSelector {
  tag: string;
  values: readonly string[];
}

export interface OverpassMarketScoutSourceOptions {
  fetchImpl?: typeof fetch;
}

export class OverpassMarketScoutSource implements MarketScoutSource {
  readonly #fetch: typeof fetch;

  constructor(options: OverpassMarketScoutSourceOptions = {}) {
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async discover(request: MarketScoutDiscoveryRequest): Promise<unknown> {
    if (request.budget.maxSourceUrls < 1 || request.budget.maxOrganizations < 1) {
      return { sourceUrlsReviewed: 0, paidSpend: 0, candidates: [] };
    }
    const sample = marketSamples[request.task.marketKey];
    const selector = laneSelectors[request.task.laneKey];
    const query = buildQuery(sample, selector, request);
    const json = await fetchOverpassJson({
      query,
      signal: request.signal,
      fetchImpl: this.#fetch
    });
    const parsed = overpassResponseSchema.safeParse(json);
    if (!parsed.success) throw new Error("OVERPASS_RESPONSE_SCHEMA_INVALID");

    const candidates = [];
    const seenDomains = new Set<string>();
    for (const element of parsed.data.elements) {
      if (candidates.length >= request.budget.maxOrganizations) break;
      const tags = element.tags;
      if (!tags) continue;
      const name = tags.name?.trim();
      const category = tags.category.trim();
      const website = safePublicWebsite(tags.website);
      if (!name || name.length < 3 || !category || !website) continue;
      const domain = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      candidates.push({
        candidate: {
          laneKey: request.task.laneKey,
          marketKey: request.task.marketKey,
          companyName: name.slice(0, 160),
          domain,
          country: sample.countryCode,
          sourceUrl: `https://www.openstreetmap.org/${tags.osm_type}/${element.id}`,
          reportedPublicWebsiteUrl: website,
          sourceKind: "OPEN_DATASET",
          synthetic: false,
          signalKeys: signalKeysFor(request.task.laneKey, tags, sample.countryCode),
          marketSignalKeys: [],
          riskFlags: []
        },
        publicText: `${name} ${category}`.slice(0, 4_000)
      });
    }

    return { sourceUrlsReviewed: 1, paidSpend: 0, candidates };
  }
}

export function marketScoutSampleLabel(marketKey: MarketKey): string {
  return marketSamples[marketKey].label;
}

export function marketScoutQueryFilter(task: {
  marketKey: MarketKey;
  laneKey: LaneKey;
}): string {
  const sample = marketSamples[task.marketKey];
  const selector = laneSelectors[task.laneKey];
  return [
    `bbox=${sample.bbox.join(",")}`,
    `${selector.tag}=${selector.values.join("|")}`,
    "requires=name,website",
    "fields=osm_type,name,website,category,opening_hours"
  ].join(";");
}

function buildQuery(
  sample: MarketSample,
  selector: LaneSelector,
  request: MarketScoutDiscoveryRequest
): string {
  const timeoutSeconds = Math.max(
    1,
    Math.min(4, Math.floor(request.budget.maxElapsedMs / 1_000) - 1)
  );
  const values = selector.values.join("|");
  const bbox = sample.bbox.join(",");
  const outputLimit = Math.min(27, Math.max(3, request.budget.maxOrganizations * 3));
  return (
    `[out:json][timeout:${timeoutSeconds}][maxsize:${OVERPASS_QUERY_MEMORY_BYTES}];` +
    `nwr(${bbox})["${selector.tag}"~"^(${values})$"]["name"]["website"];` +
    `convert candidate ::id=id(),osm_type=type(),name=t["name"],website=t["website"],category=t["${selector.tag}"],opening_hours=t["opening_hours"];` +
    `out tags ${outputLimit};`
  );
}

function signalKeysFor(
  laneKey: LaneKey,
  tags: Readonly<{ opening_hours?: string | undefined }>,
  countryCode: string
): string[] {
  const base = laneKey === "serviceflow"
    ? "non_emergency_maintenance"
    : laneKey === "beautyflow"
      ? "non_medical_beauty"
      : "non_regulated_service";
  const signals = [base];
  if (laneKey === "beautyflow" && tags.opening_hours?.trim()) {
    signals.push("catalog_hours_visible");
  }
  // Research parsing is not evidence of Persian product or country readiness.
  if (countryCode !== "IR") {
    signals.push("supported_public_language", "country_research_ready");
  }
  return signals;
}

function safePublicWebsite(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateAddress(hostname)) {
      return null;
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isPrivateAddress(hostname: string): boolean {
  const version = isIP(hostname);
  if (version === 4) {
    const [first = 0, second = 0] = hostname.split(".").map(Number);
    return first === 0 || first === 10 || first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  if (version === 6) {
    return hostname === "::" || hostname === "::1" || hostname.startsWith("fc") ||
      hostname.startsWith("fd") || hostname.startsWith("fe8") ||
      hostname.startsWith("fe9") || hostname.startsWith("fea") || hostname.startsWith("feb");
  }
  return false;
}

export const OVERPASS_MARKET_SCOUT_SOURCE_INFO = Object.freeze({
  provider: "OpenStreetMap Overpass API",
  endpoint: OVERPASS_ENDPOINT,
  attribution: "© OpenStreetMap contributors; data available under ODbL 1.0",
  licenseUrl: "https://www.openstreetmap.org/copyright",
  userAgent: USER_AGENT,
  responseByteLimit: MAX_RESPONSE_BYTES,
  parallelRequests: 1
});
