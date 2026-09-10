import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateSecurityAuditEvent } from "@/modules/identity/application/security-audit-port";

const baseEvent = {
  eventType: "SESSION_ROTATED" as const,
  outcome: "SUCCEEDED" as const,
  occurredAt: new Date("2026-09-04T12:00:00.000Z"),
  tenantId: randomUUID(),
  actorId: randomUUID(),
  sessionId: randomUUID(),
  subjectHash: "a".repeat(64),
  details: { generation: 2 }
};

describe("security audit contract", () => {
  it("accepts bounded primitive details without credential material", () => {
    expect(validateSecurityAuditEvent(baseEvent)).toMatchObject({
      eventType: "SESSION_ROTATED",
      details: { generation: 2 }
    });
  });

  it.each([
    "token",
    "sessionToken",
    "cookie_value",
    "clientSecret",
    "authorization",
    "password",
    "csrfHash"
  ])("rejects secret-bearing detail key %s", (key) => {
    expect(() =>
      validateSecurityAuditEvent({
        ...baseEvent,
        details: { [key]: "must-never-be-persisted" }
      })
    ).toThrow(/detail/i);
  });

  it("rejects nested or oversized details", () => {
    expect(() =>
      validateSecurityAuditEvent({
        ...baseEvent,
        details: { nested: { unsafe: true } } as never
      })
    ).toThrow(/detail/i);
    expect(() =>
      validateSecurityAuditEvent({
        ...baseEvent,
        details: Object.fromEntries(
          Array.from({ length: 17 }, (_, index) => [`field${index}`, index])
        )
      })
    ).toThrow(/detail/i);
  });
});
