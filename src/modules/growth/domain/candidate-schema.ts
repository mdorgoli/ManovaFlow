import { isIP } from "node:net";
import { z } from "zod";
import { LANE_KEYS, MARKET_KEYS } from "./types";

const signalKey = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/, "Signal keys must be snake_case identifiers");

export const candidateSchema = z
  .strictObject({
    laneKey: z.enum(LANE_KEYS),
    marketKey: z.enum(MARKET_KEYS),
    companyName: z.string().trim().min(3).max(160),
    domain: z.string().trim().toLowerCase().min(3).max(253),
    country: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase()),
    sourceUrl: z.string().url(),
    reportedPublicWebsiteUrl: z.string().url().optional(),
    sourceKind: z.enum([
      "SYNTHETIC",
      "OFFICIAL_REGISTRY",
      "PUBLIC_COMPANY_WEBSITE",
      "OFFICIAL_ASSOCIATION",
      "OFFICIAL_PROCUREMENT",
      "OPEN_DATASET",
      "WARM_REFERRAL"
    ]),
    synthetic: z.boolean(),
    signalKeys: z.array(signalKey).max(30),
    marketSignalKeys: z.array(signalKey).max(30),
    riskFlags: z.array(signalKey).max(20)
  })
  .superRefine((candidate, context) => {
    let url: URL;
    try {
      url = new URL(candidate.sourceUrl);
    } catch {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Evidence URL is invalid"
      });
      return;
    }

    if (url.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Evidence URL must use HTTPS"
      });
    }

    if (url.username || url.password) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Credentials are forbidden in evidence URLs"
      });
    }

    if (candidate.reportedPublicWebsiteUrl) {
      validatePublicUrl(
        candidate.reportedPublicWebsiteUrl,
        ["reportedPublicWebsiteUrl"],
        context
      );
    }

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      isPrivateAddress(hostname)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Private and local evidence URLs are forbidden"
      });
    }

    const reservedExample =
      hostname === "example" || hostname.endsWith(".example");
    const domainIsExample =
      candidate.domain === "example" || candidate.domain.endsWith(".example");

    if (candidate.synthetic) {
      if (candidate.sourceKind !== "SYNTHETIC") {
        context.addIssue({
          code: "custom",
          path: ["sourceKind"],
          message: "Synthetic records require SYNTHETIC source kind"
        });
      }
      if (!reservedExample || !domainIsExample) {
        context.addIssue({
          code: "custom",
          path: ["domain"],
          message: "Synthetic records must use a reserved example domain"
        });
      }
    } else if (
      candidate.sourceKind === "SYNTHETIC" ||
      reservedExample ||
      domainIsExample
    ) {
      context.addIssue({
        code: "custom",
        path: ["synthetic"],
        message: "Public records cannot use synthetic example sources"
      });
    }
  });

function validatePublicUrl(
  value: string,
  path: string[],
  context: z.RefinementCtx
): void {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    context.addIssue({
      code: "custom",
      path,
      message: "Public website URL must use HTTPS"
    });
  }
  if (url.username || url.password) {
    context.addIssue({
      code: "custom",
      path,
      message: "Credentials are forbidden in public website URLs"
    });
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isPrivateAddress(hostname)
  ) {
    context.addIssue({
      code: "custom",
      path,
      message: "Private and local public website URLs are forbidden"
    });
  }
}

function isPrivateAddress(hostname: string): boolean {
  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = hostname
      .split(".")
      .map((part) => Number.parseInt(part, 10));
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      first === 0
    );
  }

  if (ipVersion === 6) {
    return (
      hostname === "::1" ||
      hostname === "::" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe8") ||
      hostname.startsWith("fe9") ||
      hostname.startsWith("fea") ||
      hostname.startsWith("feb")
    );
  }

  return false;
}

export type CandidateInput = z.infer<typeof candidateSchema>;

export function parseCandidate(input: unknown): CandidateInput {
  return candidateSchema.parse(input);
}
