import { describe, expect, it } from "vitest";
import { buildMarketScoutActivityFeed } from "@/modules/growth/application/market-scout-activity-read-model";
import {
  workflowActor,
  workflowAt,
  workflowFixture
} from "../helpers/marketing-workflow-fixture";

describe("four-role workflow over stored public research", () => {
  it("joins reviewed sites to scoring without treating every discovered site as qualified", () => {
    const snapshot = workflowFixture();
    const before = structuredClone(snapshot);
    const feed = buildMarketScoutActivityFeed(workflowActor, snapshot);
    expect(feed).toMatchObject({
      marketingPipeline: {
        state: "READY",
        engine: "DETERMINISTIC_RULES",
        persisted: false,
        prospects: [
          {
            domain: "qualified-fixture.test",
            qualifier: { qualified: true, status: "QUALIFIED", score: 70 },
            pitcher: { status: "READY_INTERNAL_ONLY" }
          },
          {
            domain: "below-fixture.test",
            qualifier: {
              qualified: false,
              status: "REJECTED",
              reasons: ["BELOW_FIT_THRESHOLD"]
            },
            pitcher: { status: "BLOCKED", drafts: [] }
          },
          {
            domain: "unscored-fixture.test",
            qualifier: {
              qualified: false,
              status: "NEEDS_REVIEW",
              reasons: ["NOT_SCORED_IN_THIS_RUN"]
            },
            pitcher: { status: "BLOCKED", drafts: [] }
          }
        ]
      }
    });
    expect(snapshot).toEqual(before);
    expect(JSON.stringify(feed)).not.toContain("untrusted-label-tripwire");
    expect(JSON.stringify(feed)).not.toContain("private-audit-tripwire");
  });

  it("never exposes draft copy or per-company scoring to a VIEWER", () => {
    const feed = buildMarketScoutActivityFeed(
      { ...workflowActor, role: "VIEWER" },
      workflowFixture()
    );
    expect(feed).toMatchObject({
      marketingPipeline: { state: "RESTRICTED", reason: "ROLE_RESTRICTED" }
    });
    expect(JSON.stringify(feed)).not.toContain("Internal draft");
    expect(JSON.stringify(feed)).not.toContain("workflow-score-0");
  });

  it("produces three source-bound internal previews and holds every one for human review", () => {
    const feed = buildMarketScoutActivityFeed(workflowActor, workflowFixture());
    expect(feed).toMatchObject({
      marketingPipeline: {
        proposalCount: 3,
        qualifiedSites: 1,
        prospects: [
          {
            pitcher: {
              drafts: [
                {
                  language: "en",
                  direction: "LTR",
                  sourceUrl: "https://www.qualified-fixture.test/",
                  outboundEnabled: false
                },
                {
                  language: "fr",
                  direction: "LTR",
                  sourceUrl: "https://www.qualified-fixture.test/",
                  outboundEnabled: false
                },
                {
                  language: "ar",
                  direction: "RTL",
                  sourceUrl: "https://www.qualified-fixture.test/",
                  outboundEnabled: false
                }
              ]
            },
            supervisor: {
              status: "HELD_FOR_HUMAN_REVIEW",
              outboundEnabled: false,
              authorizationToken: null,
              reasons: [
                "OUTBOUND_DISABLED",
                "LEGAL_REVIEW_REQUIRED",
                "CUSTOMER_NEED_UNVERIFIED"
              ]
            }
          },
          {},
          {}
        ]
      }
    });
  });

  it("does not score a website when its persisted company has incompatible country or provenance", () => {
    const snapshot = workflowFixture();
    snapshot.companies[0]!.country = "AE";
    expect(() => buildMarketScoutActivityFeed(workflowActor, snapshot)).toThrow(
      "MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID"
    );
  });

  it("does not confuse a public preview with a stored draft record", () => {
    const snapshot = workflowFixture();
    const feed = buildMarketScoutActivityFeed(workflowActor, snapshot);
    expect(feed).toMatchObject({
      marketingPipeline: { persisted: false, engine: "DETERMINISTIC_RULES" }
    });
    expect(snapshot.drafts).toEqual([]);
    expect(snapshot.audit).toHaveLength(1);
  });

  it("does not accept another domain as the company's own website provenance", () => {
    const snapshot = workflowFixture();
    snapshot.companies[0]!.sourceKind = "PUBLIC_COMPANY_WEBSITE";
    snapshot.companies[0]!.sourceUrl = "https://unrelated-company.test/";
    expect(() => buildMarketScoutActivityFeed(workflowActor, snapshot)).toThrow(
      "MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID"
    );
  });

  it.each(["companies", "companyScores", "runs", "suppressions"] as const)(
    "fails closed for cross-tenant %s",
    (collection) => {
      const snapshot = workflowFixture();
      snapshot.suppressions.push({
        id: "suppression",
        tenantId: workflowActor.tenantId,
        normalizedDomain: "unrelated.test",
        reason: "private-reason",
        createdAt: workflowAt
      });
      snapshot[collection][0]!.tenantId = "other-tenant";
      expect(() =>
        buildMarketScoutActivityFeed(workflowActor, snapshot)
      ).toThrow("MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID");
    }
  );

  it("keeps suppression authoritative even for an eligible score", () => {
    const snapshot = workflowFixture();
    snapshot.suppressions.push({
      id: "suppression",
      tenantId: workflowActor.tenantId,
      normalizedDomain: "qualified-fixture.test",
      reason: "private-reason",
      createdAt: workflowAt
    });
    const feed = buildMarketScoutActivityFeed(workflowActor, snapshot);
    expect(feed).toMatchObject({
      marketingPipeline: {
        prospects: [
          {
            qualifier: { qualified: false, reasons: ["SUPPRESSED_DOMAIN"] },
            pitcher: { status: "BLOCKED", drafts: [] }
          },
          {},
          {}
        ]
      }
    });
    expect(JSON.stringify(feed)).not.toContain("private-reason");
  });

  it("does not reuse a score from a different run", () => {
    const snapshot = workflowFixture();
    snapshot.companyScores[0]!.runId = "older-run";
    expect(buildMarketScoutActivityFeed(workflowActor, snapshot)).toMatchObject(
      {
        marketingPipeline: {
          prospects: [
            {
              qualifier: {
                qualified: false,
                reasons: ["NOT_SCORED_IN_THIS_RUN"]
              },
              pitcher: { drafts: [] }
            },
            {},
            {}
          ]
        }
      }
    );
  });

  it("blocks drafting from instruction-contaminated website evidence", () => {
    const snapshot = workflowFixture();
    const bundle = snapshot.audit[0]!.details.websiteReviewEvidence as {
      reviews: { instructionLikeTextDetected: boolean }[];
    };
    bundle.reviews[0]!.instructionLikeTextDetected = true;
    expect(buildMarketScoutActivityFeed(workflowActor, snapshot)).toMatchObject(
      {
        marketingPipeline: {
          prospects: [
            {
              qualifier: {
                qualified: false,
                reasons: ["UNTRUSTED_INSTRUCTION_DETECTED"]
              },
              pitcher: { drafts: [] }
            },
            {},
            {}
          ]
        }
      }
    );
  });

  it.each(["score", "status", "explanation", "source"])(
    "rejects inconsistent %s before presenting a qualification",
    (mutation) => {
      const snapshot = workflowFixture();
      if (mutation === "score") snapshot.companyScores[0]!.total = 100;
      if (mutation === "status")
        snapshot.companyScores[0]!.status = "BELOW_THRESHOLD";
      if (mutation === "explanation")
        snapshot.companyScores[0]!.explanation[0]!.awarded = 99;
      if (mutation === "source")
        snapshot.companies[0]!.sourceUrl = "https://name:secret@private.test";
      expect(() =>
        buildMarketScoutActivityFeed(workflowActor, snapshot)
      ).toThrow("MARKET_SCOUT_ACTIVITY_READ_MODEL_INVALID");
    }
  );
});
