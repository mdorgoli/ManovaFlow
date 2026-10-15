import { lookup as nodeLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LaneKey } from "../domain/types";
import type {
  MarketScoutWebsiteReviewer,
  WebsiteReviewBudget,
  WebsiteReviewFact,
  WebsiteReviewRequest,
  WebsiteReviewResult
} from "../application/market-scout-website-review";

const USER_AGENT = "ManovaFlow-MarketScout/0.1";
const ROBOTS_PRODUCT_TOKEN = "ManovaFlow-MarketScout";
const MAX_REDIRECTS = 2;
const ROBOTS_MAX_BYTES = 64_000;

type LookupResult = { address: string; family: number };
type Lookup = (hostname: string) => Promise<readonly LookupResult[]>;

export interface PublicWebsiteReviewerOptions {
  fetchImpl?: typeof fetch;
  lookup?: Lookup;
}

export class PublicWebsiteReviewer implements MarketScoutWebsiteReviewer {
  readonly #fetch: typeof fetch;
  readonly #lookup: Lookup;

  constructor(options: PublicWebsiteReviewerOptions = {}) {
    this.#fetch = options.fetchImpl ?? fetch;
    this.#lookup =
      options.lookup ??
      (async (hostname) => nodeLookup(hostname, { all: true, verbatim: true }));
  }

  async review(request: WebsiteReviewRequest): Promise<WebsiteReviewResult> {
    validateBudget(request.budget);
    const controller = new AbortController();
    const onAbort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(
      () => controller.abort("WEBSITE_REVIEW_TIME_BUDGET_EXCEEDED"),
      request.budget.maxElapsedMs
    );
    let requestsMade = 0;
    let bytesRead = 0;

    const base = (): WebsiteReviewResult => ({
      sourceUrl: request.sourceUrl,
      finalUrl: null,
      outcome: "FAILED",
      reason: "WEBSITE_REVIEW_FAILED",
      errorCode: "WEBSITE_REVIEW_FAILED",
      requestsMade,
      bytesRead,
      contentHandling: "UNTRUSTED_DATA_ONLY",
      untrustedInstructionTextDetected: false,
      documentedFacts: [],
      potentialFitReason: potentialFitReason(request.laneKey, []),
      unknowns: defaultUnknowns()
    });

    const fetchBounded = async (startUrl: URL, maxBytes: number) => {
      let current = startUrl;
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        await assertPublicHttpsTarget(current, this.#lookup);
        if (requestsMade >= request.budget.maxRequests) {
          throw new ReviewError("WEBSITE_REQUEST_BUDGET_EXCEEDED");
        }
        requestsMade += 1;
        const response = await this.#fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "text/html,text/plain;q=0.9",
            "User-Agent": USER_AGENT
          }
        });
        if (isRedirect(response.status)) {
          const location = response.headers.get("location");
          if (!location || redirects === MAX_REDIRECTS) {
            throw new ReviewError("WEBSITE_REDIRECT_INVALID");
          }
          current = new URL(location, current);
          continue;
        }
        const body = await readLimited(response, maxBytes);
        bytesRead += body.bytes;
        return { response, body: body.text, finalUrl: current };
      }
      throw new ReviewError("WEBSITE_REDIRECT_INVALID");
    };

    try {
      const sourceUrl = parsePublicHttpsUrl(request.sourceUrl);
      const robotsUrl = new URL("/robots.txt", sourceUrl.origin);
      const robots = await fetchBounded(
        robotsUrl,
        Math.min(ROBOTS_MAX_BYTES, request.budget.maxResponseBytes)
      );
      if (robots.response.status === 200) {
        if (!robotsAllows(robots.body, sourceUrl.pathname)) {
          return {
            ...base(),
            outcome: "SKIPPED",
            reason: "ROBOTS_DISALLOWED",
            errorCode: null,
            requestsMade,
            bytesRead
          };
        }
      } else if (![404, 410].includes(robots.response.status)) {
        return {
          ...base(),
          outcome: "SKIPPED",
          reason: "ROBOTS_UNAVAILABLE",
          errorCode: "ROBOTS_HTTP_" + robots.response.status,
          requestsMade,
          bytesRead
        };
      }

      const page = await fetchBounded(
        sourceUrl,
        request.budget.maxResponseBytes
      );
      if (!page.response.ok) {
        return {
          ...base(),
          finalUrl: page.finalUrl.toString(),
          reason: "WEBSITE_HTTP_ERROR",
          errorCode: "WEBSITE_HTTP_" + page.response.status,
          requestsMade,
          bytesRead
        };
      }
      const contentType =
        page.response.headers.get("content-type")?.toLowerCase() ?? "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain")
      ) {
        return {
          ...base(),
          finalUrl: page.finalUrl.toString(),
          outcome: "SKIPPED",
          reason: "WEBSITE_CONTENT_TYPE_UNSUPPORTED",
          errorCode: null,
          requestsMade,
          bytesRead
        };
      }
      const cleanText = extractVisibleText(page.body);
      const normalized = normalizeText(cleanText);
      const facts = extractFacts(request.laneKey, normalized);
      return {
        ...base(),
        finalUrl: page.finalUrl.toString(),
        outcome: "SUCCEEDED",
        reason:
          facts.length > 0
            ? "PUBLIC_PAGE_REVIEWED"
            : "PUBLIC_PAGE_REVIEWED_NO_ALLOWLISTED_FACTS",
        errorCode: null,
        requestsMade,
        bytesRead,
        untrustedInstructionTextDetected: hasInstructionLikeText(normalized),
        documentedFacts: facts,
        potentialFitReason: potentialFitReason(request.laneKey, facts)
      };
    } catch (error) {
      const code = reviewErrorCode(error, controller.signal);
      return {
        ...base(),
        outcome:
          code === "PRIVATE_NETWORK_TARGET" || code === "WEBSITE_URL_UNSAFE"
            ? "REJECTED"
            : "FAILED",
        reason: code,
        errorCode: code,
        requestsMade,
        bytesRead
      };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }
}

function validateBudget(budget: WebsiteReviewBudget): void {
  if (
    !Number.isSafeInteger(budget.maxRequests) ||
    budget.maxRequests < 1 ||
    budget.maxRequests > 4 ||
    !Number.isSafeInteger(budget.maxElapsedMs) ||
    budget.maxElapsedMs < 1 ||
    budget.maxElapsedMs > 15_000 ||
    !Number.isSafeInteger(budget.maxResponseBytes) ||
    budget.maxResponseBytes < 1 ||
    budget.maxResponseBytes > 256_000
  ) {
    throw new Error("WEBSITE_REVIEW_BUDGET_INVALID");
  }
}

function parsePublicHttpsUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ReviewError("WEBSITE_URL_UNSAFE");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new ReviewError("WEBSITE_URL_UNSAFE");
  }
  return url;
}

async function assertPublicHttpsTarget(
  url: URL,
  lookup: Lookup
): Promise<void> {
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ReviewError("PRIVATE_NETWORK_TARGET");
  }
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname))
      throw new ReviewError("PRIVATE_NETWORK_TARGET");
    parsePublicHttpsUrl(url.toString());
    return;
  }
  parsePublicHttpsUrl(url.toString());
  let addresses: readonly LookupResult[];
  try {
    addresses = await lookup(hostname);
  } catch {
    throw new ReviewError("WEBSITE_DNS_FAILED");
  }
  if (
    addresses.length === 0 ||
    addresses.some((item) => !isPublicAddress(item.address))
  ) {
    throw new ReviewError("PRIVATE_NETWORK_TARGET");
  }
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a = 0, b = 0, c = 0] = address.split(".").map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0 && c === 113)
    )
      return false;
    return true;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith("::ffff:")) {
      return isPublicAddress(lower.slice("::ffff:".length));
    }
    return !(
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb") ||
      lower.startsWith("ff")
    );
  }
  return false;
}

async function readLimited(
  response: Response,
  maxBytes: number
): Promise<{ text: string; bytes: number }> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ReviewError("WEBSITE_RESPONSE_TOO_LARGE");
  }
  if (!response.body) return { text: "", bytes: 0 };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    total += item.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ReviewError("WEBSITE_RESPONSE_TOO_LARGE");
    }
    chunks.push(item.value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(combined),
    bytes: total
  };
}

function robotsAllows(text: string, path: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim());
  const groups: Array<{
    agents: string[];
    allowed: string[];
    disallowed: string[];
  }> = [];
  let current: (typeof groups)[number] | null = null;
  for (const line of lines) {
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (
        !current ||
        current.allowed.length > 0 ||
        current.disallowed.length > 0
      ) {
        current = { agents: [], allowed: [], disallowed: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && key === "disallow" && value) {
      current.disallowed.push(value);
    } else if (current && key === "allow" && value) {
      current.allowed.push(value);
    }
  }
  const token = ROBOTS_PRODUCT_TOKEN.toLowerCase();
  const exact = groups.filter((group) => group.agents.includes(token));
  const selected =
    exact.length > 0
      ? exact
      : groups.filter((group) => group.agents.includes("*"));
  const disallowed = selected.flatMap((group) => group.disallowed);
  const allowed = selected.flatMap((group) => group.allowed);
  const longestDisallow = longestPrefix(path, disallowed);
  const longestAllow = longestPrefix(path, allowed);
  return (
    longestDisallow.length === 0 ||
    longestAllow.length >= longestDisallow.length
  );
}

function longestPrefix(path: string, rules: readonly string[]): string {
  return (
    rules
      .filter((rule) => path.startsWith(rule))
      .sort((a, b) => b.length - a.length)[0] ?? ""
  );
}

function extractVisibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40_000);
}

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
    .replace(/ك/g, "ک")
    .replace(/ي|ى/g, "ی")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function extractFacts(laneKey: LaneKey, text: string): WebsiteReviewFact[] {
  const facts: WebsiteReviewFact[] = [];
  const servicePattern =
    laneKey === "serviceflow"
      ? /\b(plomberie|serrurerie|electricite|electricien|chauffage|climatisation|maintenance|reparation|plumber|locksmith|electrician|hvac)\b/
      : laneKey === "beautyflow"
        ? /\b(salon|coiffure|coiffeur|coloration|beaute|hair|hairdresser|beauty|nail)\b/
        : /\b(agence|communication|branding|design|publicite|campagne|creative|advertising|web design)\b/;
  const persianServicePattern =
    laneKey === "serviceflow"
      ? /تاسیسات|لوله\s?کشی|برق\s?کاری|تعمیر پکیج|سرویس کولر|تعمیرات ساختمان/u
      : laneKey === "beautyflow"
        ? /سالن زیبایی|ارایشگاه|خدمات ناخن|رنگ مو/u
        : /طراحی سایت|طراحی گرافیک|اژانس تبلیغاتی|برندسازی/u;
  if (servicePattern.test(text) || persianServicePattern.test(text))
    facts.push("PUBLIC_SERVICE_DESCRIPTION");
  if (
    /\b(reservation|reserver|rendez-vous|booking|book online|prendre rendez vous)\b/.test(
      text
    ) ||
    /رزرو انلاین|ثبت درخواست|نوبت\s?دهی/u.test(text)
  ) {
    facts.push("PUBLIC_BOOKING_PATH");
  }
  if (
    /\b(horaires|opening hours|lundi|monday|samedi|saturday)\b/.test(text) ||
    /ساعات کاری|ساعت کار|ساعت فعالیت/u.test(text)
  ) {
    facts.push("PUBLIC_HOURS");
  }
  if (
    /\b(nos salons|nos agences|plusieurs adresses|locations|multi-location)\b/.test(
      text
    )
  ) {
    facts.push("PUBLIC_MULTI_LOCATION");
  }
  if (
    laneKey === "briefflow" &&
    /\b(brief|votre projet|project brief|parlez-nous de votre projet)\b/.test(
      text
    )
  ) {
    facts.push("PUBLIC_BRIEF_PATH");
  }
  if (
    laneKey === "briefflow" &&
    /\b(validation|approbation|approval|retours?)\b/.test(text)
  ) {
    facts.push("PUBLIC_APPROVAL_LANGUAGE");
  }
  if (
    /\b(nos services|prestations|offres|packages|services)\b/.test(text) ||
    /خدمات ما|لیست خدمات|بسته خدمات/u.test(text)
  ) {
    facts.push("PUBLIC_PACKAGED_SERVICE_LANGUAGE");
  }
  return facts;
}

function hasInstructionLikeText(text: string): boolean {
  return (
    /ignore (all |any )?(previous|prior) instructions|system message|developer message|act as (an?|the)|assistant:/.test(
      text
    ) || /دستور(?:های|ات) قبلی.{0,30}نادیده|پیام سیستم|نقش دستیار/u.test(text)
  );
}

function potentialFitReason(
  laneKey: LaneKey,
  facts: readonly WebsiteReviewFact[]
): string {
  const product =
    laneKey === "serviceflow"
      ? "ServiceFlow local demo"
      : laneKey === "beautyflow"
        ? "BeautyFlow research concept"
        : "BriefFlow research concept";
  return facts.length === 0
    ? `No allowlisted public page fact was captured; potential fit for ${product} remains unassessed.`
    : `${facts.length} allowlisted public page fact(s) may justify a later human fit review for ${product}; need and interest are not established.`;
}

function defaultUnknowns(): string[] {
  return [
    "WEBSITE_OWNERSHIP_NOT_INDEPENDENTLY_VERIFIED",
    "WORKFLOW_PAIN_UNVERIFIED",
    "BUYER_AUTHORITY_UNVERIFIED",
    "CUSTOMER_INTEREST_UNVERIFIED"
  ];
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function reviewErrorCode(error: unknown, signal: AbortSignal): string {
  if (signal.aborted) return "WEBSITE_REVIEW_TIME_BUDGET_EXCEEDED";
  if (error instanceof ReviewError) return error.code;
  return "WEBSITE_FETCH_FAILED";
}

class ReviewError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ReviewError";
  }
}
