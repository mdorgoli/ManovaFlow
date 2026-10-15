export const LANE_KEYS = ["serviceflow", "beautyflow", "briefflow"] as const;
export type LaneKey = (typeof LANE_KEYS)[number];

export const MARKET_KEYS = [
  "fr-france",
  "tr-istanbul",
  "iq-kri-erbil",
  "ae-dubai",
  "ir-tehran"
] as const;
export type MarketKey = (typeof MARKET_KEYS)[number];

export const ROLES = ["OWNER", "OPERATOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export interface ActorContext {
  tenantId: string;
  actorId: string;
  role: Role;
}

export type PackState = "ACTIVE_DEVELOPMENT" | "VALIDATION_BACKLOG";
export type LaneState =
  "RESEARCH_ONLY" | "HUMAN_SEND" | "BOUNDED_AUTOMATION" | "PAUSED" | "KILLED";

export interface EvidenceReference {
  sourceUrl: string;
  provenance: string;
  observedAt: string;
  synthetic: boolean;
}

export interface DailyCaps {
  sourceUrls: number;
  organizations: number;
  drafts: number;
  markets: number;
  elapsedMs: number;
  consecutiveLowValue: number;
  paidSpend: 0;
}
