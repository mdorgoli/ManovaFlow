import { describe, expect, it } from "vitest";
import { getDemoContext } from "@/lib/demo-context";

const validEnvironment = {
  NODE_ENV: "development",
  DEMO_MODE: "true",
  DEMO_TENANT_ID: "10000000-0000-4000-8000-000000000001",
  DEMO_ACTOR_ID: "20000000-0000-4000-8000-000000000001",
  DEMO_ACTOR_ROLE: "OWNER"
};

describe("server-only demo context", () => {
  it("returns a validated actor only in explicit non-production demo mode", () => {
    expect(getDemoContext(validEnvironment)).toEqual({
      tenantId: validEnvironment.DEMO_TENANT_ID,
      actorId: validEnvironment.DEMO_ACTOR_ID,
      role: "OWNER"
    });
  });

  it("refuses demo identity in production", () => {
    expect(() =>
      getDemoContext({ ...validEnvironment, NODE_ENV: "production" })
    ).toThrow(/production/i);
  });

  it("fails closed when demo mode or an identity field is missing", () => {
    expect(() =>
      getDemoContext({ ...validEnvironment, DEMO_MODE: "false" })
    ).toThrow(/disabled/i);
    expect(() =>
      getDemoContext({ ...validEnvironment, DEMO_ACTOR_ID: undefined })
    ).toThrow();
  });
});
