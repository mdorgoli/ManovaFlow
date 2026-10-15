import { describe, expect, it } from "vitest";
import {
  evaluateComplianceGate,
  REQUIRED_COMPLIANCE_CATEGORIES
} from "@/modules/compliance/domain/gate";

const now = new Date("2026-09-04T08:00:00.000Z");

describe("Legal & Compliance Gate", () => {
  it("allows bounded research while making clear it is not legal advice", () => {
    const decision = evaluateComplianceGate(
      {
        marketKey: "iq-kri-erbil",
        targetStage: "RESEARCH_ONLY",
        evidence: [],
        humanLegalReview: false
      },
      now
    );

    expect(decision.status).toBe("RESEARCH_ONLY_ALLOWED");
    expect(decision.disclaimer).toMatch(/جایگزین وکیل نیست/);
    expect(decision.authorizationToken).toBeNull();
  });

  it("fails closed for Human-Send when official evidence or legal paths are unknown", () => {
    const decision = evaluateComplianceGate(
      {
        marketKey: "tr-istanbul",
        targetStage: "HUMAN_SEND",
        evidence: [
          {
            category: "DATA",
            classification: "FACT",
            publisherType: "OFFICIAL",
            sourceUrl:
              "https://www.kvkk.gov.tr/Icerik/6649/Personal-Data-Protection-Law",
            checkedAt: "2026-09-04T00:00:00.000Z",
            summary: "KVKK applies; case-specific scope still requires review."
          },
          {
            category: "PAYMENT",
            classification: "UNKNOWN",
            publisherType: "OFFICIAL",
            sourceUrl: "https://example.gov.example/payment",
            checkedAt: "2026-09-04T00:00:00.000Z",
            summary: "Cross-border payment route is not established."
          }
        ],
        humanLegalReview: false
      },
      now
    );

    expect(decision.status).toBe("HUMAN_SEND_BLOCKED");
    expect(decision.missingCategories).toEqual(
      expect.arrayContaining(
        REQUIRED_COMPLIANCE_CATEGORIES.filter((category) => category !== "DATA")
      )
    );
    expect(decision.unknownCategories).toContain("PAYMENT");
    expect(decision.authorizationToken).toBeNull();
  });

  it("requires an authorized human review even when fresh official facts cover every category", () => {
    const evidence = REQUIRED_COMPLIANCE_CATEGORIES.map((category) => ({
      category,
      classification: "FACT" as const,
      publisherType: "OFFICIAL" as const,
      sourceUrl: "https://authority.example/rule",
      checkedAt: "2026-09-04T00:00:00.000Z",
      summary: "Official source captured for scoped human review."
    }));

    const decision = evaluateComplianceGate(
      {
        marketKey: "fr-france",
        targetStage: "HUMAN_SEND",
        evidence,
        humanLegalReview: false
      },
      now
    );

    expect(decision.status).toBe("HUMAN_REVIEW_REQUIRED");
    expect(decision.authorizationToken).toBeNull();
    expect(decision.escalations).toContain("AUTHORIZED_LEGAL_REVIEW");
  });
});
