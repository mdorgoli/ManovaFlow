import { describe, expect, it } from "vitest";
import {
  authorizeDashboard,
  authorizeDraftDecision,
  authorizeResearchRun,
  authorizeServiceFlowMutation,
  authorizeServiceFlowRead,
  authorizeSuppression
} from "@/lib/api-policy";

const base = {
  tenantId: "10000000-0000-4000-8000-000000000001",
  actorId: "20000000-0000-4000-8000-000000000001"
};

describe("API policy", () => {
  it("allows every known role to view the dashboard", () => {
    for (const role of ["OWNER", "OPERATOR", "VIEWER"] as const) {
      expect(() => authorizeDashboard({ ...base, role }, new Headers())).not.toThrow();
    }
  });

  it("requires Owner or Operator plus an idempotency key to run research", () => {
    const headers = new Headers({ "Idempotency-Key": "manual-batch-001" });
    expect(authorizeResearchRun({ ...base, role: "OPERATOR" }, headers)).toBe(
      "manual-batch-001"
    );
    expect(() =>
      authorizeResearchRun({ ...base, role: "VIEWER" }, headers)
    ).toThrow(/cannot perform/i);
    expect(() =>
      authorizeResearchRun({ ...base, role: "OWNER" }, new Headers())
    ).toThrow(/Idempotency-Key/i);
  });

  it("reserves internal draft decisions for Owner and never grants send", () => {
    expect(
      authorizeDraftDecision({ ...base, role: "OWNER" }, new Headers())
    ).toEqual({ outboundEnabled: false });
    expect(() =>
      authorizeDraftDecision({ ...base, role: "OPERATOR" }, new Headers())
    ).toThrow(/cannot perform/i);
  });

  it("allows suppression to Owner and Operator but not Viewer", () => {
    expect(() =>
      authorizeSuppression({ ...base, role: "OPERATOR" }, new Headers())
    ).not.toThrow();
    expect(() =>
      authorizeSuppression({ ...base, role: "VIEWER" }, new Headers())
    ).toThrow(/cannot perform/i);
  });

  it.each([
    "x-tenant-id",
    "x-actor-id",
    "x-role",
    "x-session-id",
    "x-mfa-verified",
    "x-auth-subject"
  ])(
    "rejects client-controlled identity header %s",
    (header) => {
      const headers = new Headers({ [header]: "attacker-controlled" });
      expect(() =>
        authorizeDashboard({ ...base, role: "OWNER" }, headers)
      ).toThrow(/client-controlled identity/i);
    }
  );

  it("allows authenticated roles to read ServiceFlow while rejecting identity headers", () => {
    for (const role of ["OWNER", "OPERATOR", "VIEWER"] as const) {
      expect(() => authorizeServiceFlowRead({ ...base, role }, new Headers())).not.toThrow();
    }
    expect(() =>
      authorizeServiceFlowRead(
        { ...base, role: "OWNER" },
        new Headers({ "x-tenant-id": "client-controlled" })
      )
    ).toThrow(/client-controlled identity/i);
  });

  it("requires Owner or Operator and a bounded idempotency key for ServiceFlow mutation", () => {
    const headers = new Headers({ "Idempotency-Key": "serviceflow-command-001" });

    expect(authorizeServiceFlowMutation({ ...base, role: "OWNER" }, headers)).toBe(
      "serviceflow-command-001"
    );
    expect(authorizeServiceFlowMutation({ ...base, role: "OPERATOR" }, headers)).toBe(
      "serviceflow-command-001"
    );
    expect(() =>
      authorizeServiceFlowMutation({ ...base, role: "VIEWER" }, headers)
    ).toThrow(/cannot perform/i);
    expect(() =>
      authorizeServiceFlowMutation({ ...base, role: "OWNER" }, new Headers())
    ).toThrow(/Idempotency-Key/i);
  });
});
