import { describe, expect, it } from "vitest";
import { growthManifests } from "@/modules/growth/manifests";
import { LANE_KEYS } from "@/modules/growth/domain/types";

describe("vertical manifests", () => {
  it("registers three independent Research-Only lanes", () => {
    expect(Object.keys(growthManifests).sort()).toEqual([...LANE_KEYS].sort());

    for (const manifest of Object.values(growthManifests)) {
      expect(manifest.initialState).toBe("RESEARCH_ONLY");
      expect(
        manifest.scoring.signals.reduce((sum, signal) => sum + signal.weight, 0)
      ).toBe(100);
      expect(manifest.dailyCaps.paidSpend).toBe(0);
      expect(manifest.dailyCaps.markets).toBeLessThanOrEqual(4);
      expect(manifest.allowedClaims.length).toBeGreaterThan(0);
      expect(manifest.forbiddenClaims.length).toBeGreaterThan(0);
      expect(manifest.prohibitedRiskFlags.length).toBeGreaterThan(0);
    }
  });

  it("keeps only ServiceFlow in active product development", () => {
    expect(growthManifests.serviceflow.packState).toBe("ACTIVE_DEVELOPMENT");
    expect(growthManifests.beautyflow.packState).toBe("VALIDATION_BACKLOG");
    expect(growthManifests.briefflow.packState).toBe("VALIDATION_BACKLOG");
    expect(growthManifests.beautyflow.draftKind).toBe("WAITLIST_PREVIEW");
    expect(growthManifests.briefflow.draftKind).toBe("WAITLIST_PREVIEW");
  });

  it("uses distinct vertical signals, risks, and claims without market policy", () => {
    const manifests = Object.values(growthManifests);
    const signalSets = manifests.map((manifest) =>
      manifest.scoring.signals.map((signal) => signal.key).join("|")
    );
    const riskSets = manifests.map((manifest) =>
      manifest.prohibitedRiskFlags.join("|")
    );

    expect(new Set(signalSets).size).toBe(3);
    expect(new Set(riskSets).size).toBe(3);

    for (const manifest of manifests) {
      const serialized = JSON.stringify(manifest);
      expect(serialized).not.toMatch(/fr-france|tr-istanbul|iq-kri-erbil|ae-dubai/);
      expect(serialized).not.toMatch(/KVKK|IYS|GDPR|UAE/i);
    }
  });

  it("matches the approved independent daily caps", () => {
    expect(growthManifests.serviceflow.dailyCaps).toMatchObject({
      sourceUrls: 40,
      organizations: 20,
      drafts: 5,
      paidSpend: 0
    });
    expect(growthManifests.beautyflow.dailyCaps).toMatchObject({
      sourceUrls: 25,
      organizations: 10,
      drafts: 3,
      paidSpend: 0
    });
    expect(growthManifests.briefflow.dailyCaps).toMatchObject({
      sourceUrls: 25,
      organizations: 10,
      drafts: 3,
      paidSpend: 0
    });
  });
});
