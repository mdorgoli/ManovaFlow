import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  requireCapability
} from "@/modules/growth/domain/rbac";

const actor = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001"
} as const;

describe("requireCapability", () => {
  it("allows an operator to run research", () => {
    expect(() =>
      requireCapability({ ...actor, role: "OPERATOR" }, "RUN_RESEARCH")
    ).not.toThrow();
  });

  it("denies a viewer from mutating research state", () => {
    expect(() =>
      requireCapability({ ...actor, role: "VIEWER" }, "RUN_RESEARCH")
    ).toThrow(AuthorizationError);
  });

  it("requires owner role for internal draft decisions", () => {
    expect(() =>
      requireCapability({ ...actor, role: "OPERATOR" }, "DECIDE_DRAFT")
    ).toThrow(AuthorizationError);
    expect(() =>
      requireCapability({ ...actor, role: "OWNER" }, "DECIDE_DRAFT")
    ).not.toThrow();
  });
});
