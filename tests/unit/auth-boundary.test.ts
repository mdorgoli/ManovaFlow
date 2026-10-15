import { describe, expect, it } from "vitest";
import { authorizeResearchRun } from "@/lib/api-policy";
import {
  authenticateRequest,
  type AuthPort,
  type MembershipPort,
  type VerifiedMembership,
  type VerifiedSession
} from "@/modules/identity/application/auth-port";

const now = new Date("2026-09-04T08:00:00.000Z");
const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "10000000-0000-4000-8000-000000000002";

function session(overrides: Partial<VerifiedSession> = {}): VerifiedSession {
  return {
    source: "SERVER_VERIFIED_SESSION",
    sessionId: "session-00000000000000000000000000000001",
    actorId: "20000000-0000-4000-8000-000000000001",
    activeTenantId: tenantA,
    issuedAt: "2026-09-04T06:00:00.000Z",
    expiresAt: "2026-09-04T10:00:00.000Z",
    mfa: {
      method: "totp",
      verifiedAt: "2026-09-04T07:55:00.000Z",
      expiresAt: "2026-09-04T09:00:00.000Z"
    },
    ...overrides
  };
}

function fixedMembershipPort(
  overrides: Partial<VerifiedMembership> = {}
): MembershipPort {
  const membership: VerifiedMembership = {
    tenantId: tenantA,
    actorId: "20000000-0000-4000-8000-000000000001",
    role: "OPERATOR",
    verifiedAt: "2026-09-04T07:59:00.000Z",
    ...overrides
  };
  return {
    resolveMembership: async () => membership
  };
}

function fixedAuthPort(value: VerifiedSession | null): AuthPort {
  return {
    resolveSession: async () => value
  };
}

function request(headers?: HeadersInit): Request {
  const url = "https://manovaflow.example/api/research/run";
  return headers ? new Request(url, { headers }) : new Request(url);
}

const productionPolicy = {
  environment: "production" as const,
  now
};

describe("provider-neutral authentication boundary", () => {
  it.each([
    "x-tenant-id",
    "x-actor-id",
    "x-role",
    "x-session-id",
    "x-mfa-verified",
    "x-auth-subject"
  ])("rejects client-controlled identity header %s", async (header) => {
    await expect(
      authenticateRequest({
        request: request({ [header]: tenantB }),
        authPort: fixedAuthPort(session()),
        membershipPort: fixedMembershipPort(),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "IDENTITY_SPOOFING_DETECTED" });
  });

  it("fails closed when no authenticated session exists", async () => {
    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(null),
        membershipPort: fixedMembershipPort(),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("rejects an expired session", async () => {
    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(
          session({ expiresAt: "2026-09-04T07:59:59.999Z" })
        ),
        membershipPort: fixedMembershipPort(),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("requires current MFA evidence in production", async () => {
    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(session({ mfa: null })),
        membershipPort: fixedMembershipPort(),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "MFA_REQUIRED" });

    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(
          session({
            mfa: {
              method: "webauthn",
              verifiedAt: "2026-09-04T06:00:00.000Z",
              expiresAt: "2026-09-04T08:00:00.000Z"
            }
          })
        ),
        membershipPort: fixedMembershipPort(),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "MFA_EXPIRED" });
  });

  it("rejects a demo session in production even when it carries MFA-shaped data", async () => {
    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(session({ source: "DEMO_SERVER_CONTEXT" })),
        membershipPort: fixedMembershipPort(),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "DEMO_SESSION_FORBIDDEN" });
  });

  it("derives tenant and role only from server-side identity and membership", async () => {
    const actor = await authenticateRequest({
      request: request(),
      authPort: fixedAuthPort(session({ activeTenantId: tenantB })),
      membershipPort: fixedMembershipPort({
        tenantId: tenantB,
        role: "VIEWER"
      }),
      policy: productionPolicy
    });

    expect(actor).toEqual({
      tenantId: tenantB,
      actorId: "20000000-0000-4000-8000-000000000001",
      role: "VIEWER"
    });
    expect(() =>
      authorizeResearchRun(
        actor,
        new Headers({ "Idempotency-Key": "viewer-cannot-escalate" })
      )
    ).toThrow(/cannot perform/i);
  });

  it("takes RBAC authority from the server membership source, not the auth adapter", async () => {
    const actor = await authenticateRequest({
      request: request(),
      authPort: fixedAuthPort(session()),
      membershipPort: fixedMembershipPort({
        role: "VIEWER",
        verifiedAt: "2026-09-04T07:59:30.000Z"
      }),
      policy: productionPolicy
    });

    expect(actor.role).toBe("VIEWER");
    expect(() =>
      authorizeResearchRun(
        actor,
        new Headers({ "Idempotency-Key": "adapter-role-is-not-authority" })
      )
    ).toThrow(/cannot perform/i);
  });

  it("rejects an authorization claim injected into the auth-adapter payload", async () => {
    const injected = {
      ...session(),
      role: "OWNER"
    } as unknown as VerifiedSession;

    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(injected),
        membershipPort: fixedMembershipPort({ role: "VIEWER" }),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });

  it("rejects a membership resolved for a different tenant", async () => {
    await expect(
      authenticateRequest({
        request: request(),
        authPort: fixedAuthPort(session({ activeTenantId: tenantA })),
        membershipPort: fixedMembershipPort({ tenantId: tenantB }),
        policy: productionPolicy
      })
    ).rejects.toMatchObject({ code: "INVALID_MEMBERSHIP" });
  });
});
