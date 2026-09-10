import type { DailyCaps, LaneKey, LaneState, PackState } from "../domain/types";
import type { ScoringManifest } from "../domain/scoring";

export interface VerticalManifest {
  key: LaneKey;
  displayName: string;
  packState: PackState;
  initialState: Extract<LaneState, "RESEARCH_ONLY">;
  icp: string;
  scoring: ScoringManifest;
  prohibitedRiskFlags: readonly string[];
  allowedClaims: readonly string[];
  forbiddenClaims: readonly string[];
  dailyCaps: DailyCaps;
  draftKind: "PRODUCT_DISCOVERY" | "WAITLIST_PREVIEW";
  draftTemplate: string;
  killRules: readonly string[];
}
