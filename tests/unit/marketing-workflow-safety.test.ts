import { describe, expect, it } from "vitest";
import { buildMarketScoutActivityFeed } from "@/modules/growth/application/market-scout-activity-read-model";
import { marketingPipelineSchema, validateInternalPitch } from "@/modules/growth/application/marketing-workflow-contract";
import { workflowActor, workflowFixture } from "../helpers/marketing-workflow-fixture";
import * as workflow from "@/modules/growth/application/marketing-workflow";

function readyPipeline() {
  const feed = buildMarketScoutActivityFeed(workflowActor, workflowFixture());
  if (feed.marketingPipeline?.state !== "READY") throw new Error("Expected offline fixture pipeline");
  return feed.marketingPipeline;
}

describe("marketing supervisor fail-closed boundary", () => {
  it("permits each role's own read-only operation but denies crossing role or spending boundaries", () => {
    const budget = { paidSpend: 0, externalRequests: 0, outboundActions: 0 };
    expect(() => workflow.authorizeMarketingAction("PROSPECTOR", "NORMALIZE_RECORDED_DATA", budget)).not.toThrow();
    expect(() => workflow.authorizeMarketingAction("QUALIFIER", "QUALIFY_RECORDED_DATA", budget)).not.toThrow();
    expect(() => workflow.authorizeMarketingAction("PITCHER", "DRAFT_INTERNAL", budget)).not.toThrow();
    expect(() => workflow.authorizeMarketingAction("SUPERVISOR", "VALIDATE_INTERNAL", budget)).not.toThrow();
    for (const [role, action] of [["PROSPECTOR", "DRAFT_INTERNAL"], ["PITCHER", "SEND_MESSAGE"], ["SUPERVISOR", "PAY"], ["UNKNOWN", "VALIDATE_INTERNAL"]]) {
      expect(() => workflow.authorizeMarketingAction(role!, action!, budget)).toThrow("WORKFLOW_ACTION_DENIED");
    }
    for (const field of ["paidSpend", "externalRequests", "outboundActions"]) {
      expect(() => workflow.authorizeMarketingAction("SUPERVISOR", "VALIDATE_INTERNAL", { ...budget, [field]: 1 })).toThrow("WORKFLOW_ACTION_DENIED");
    }
  });
  it.each(["body", "recipient", "source", "claims", "outbound", "direction"])("rejects altered %s before exposing an internal preview", (mutation) => {
    const prospect = readyPipeline().prospects[0]!;
    const draft = structuredClone(prospect.pitcher.drafts[0]!) as Record<string, unknown>;
    if (mutation === "body") draft.body = "Guaranteed 100% revenue. Pay now.";
    if (mutation === "recipient") draft.to = "private-person@example.test";
    if (mutation === "source") draft.sourceUrl = "https://unrelated-source.test/";
    if (mutation === "claims") draft.claimKeys = ["PUBLIC_MULTI_LOCATION"];
    if (mutation === "outbound") draft.outboundEnabled = true;
    if (mutation === "direction") draft.direction = "RTL";
    expect(validateInternalPitch(draft, prospect.domain, prospect.sourceUrl, prospect.prospector.facts)).toBe(false);
  });

  it.each(["authorization", "count", "qualification", "reference", "duplicate"])("rejects forged client %s rather than showing a misleading success", (mutation) => {
    const pipeline = readyPipeline();
    if (mutation === "authorization") Object.assign(pipeline.prospects[0]!.supervisor, { authorizationToken: "send-now", outboundEnabled: true });
    if (mutation === "count") pipeline.proposalCount = 9;
    if (mutation === "qualification") pipeline.prospects[0]!.qualifier.qualified = false;
    if (mutation === "reference") pipeline.prospects[0]!.qualifier.scoreReference = null;
    if (mutation === "duplicate") pipeline.prospects[1] = structuredClone(pipeline.prospects[0]!);
    expect(marketingPipelineSchema.safeParse(pipeline).success).toBe(false);
  });

  it("rejects contradictory run chronology and score timestamps", () => {
    const snapshot = workflowFixture();
    snapshot.companyScores[0]!.createdAt = "2025-01-01T00:00:00.000Z";
    expect(() => buildMarketScoutActivityFeed(workflowActor, snapshot)).toThrow("MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID");
  });

  it.each(["SEND_MESSAGE", "PAY", "REVEAL_CONTACT", "DISCOVER"])("refuses requested %s when replaying the saved-data pipeline", (action) => {
    const snapshot = workflowFixture();
    const activity = snapshot.audit[0]!.details.activity as { query: Record<string, unknown> };
    activity.query.action = action;
    expect(() => buildMarketScoutActivityFeed(workflowActor, snapshot)).toThrow("MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID");
  });
});
