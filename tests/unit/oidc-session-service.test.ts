import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  type MembershipPort
} from "@/modules/identity/application/auth-port";
import {
  OidcSessionService,
  type IdentityLinkPort
} from "@/modules/identity/application/oidc-session-service";
import type { OidcTokenVerifierPort } from "@/modules/identity/application/oidc-port";
import type {
  IssuedSession,
  SessionStorePort
} from "@/modules/identity/application/session-port";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME
} from "@/modules/identity/infrastructure/session-cookie";

const now = new Date("2026-09-04T12:00:00.000Z");
const tenantId = "10000000-0000-4000-8000-000000000001";
const actorId = "20000000-0000-4000-8000-000000000001";
const idToken = "signed.id.token";
const identity = {
  issuer: "https://identity.example.test",
  subject: "provider-subject-001",
  issuedAt: "2026-09-04T11:59:00.000Z",
  expiresAt: "2026-09-04T12:10:00.000Z",
  mfa: {
    method: "amr:mfa",
    verifiedAt: "2026-09-04T11:58:00.000Z",
    expiresAt: "2026-09-04T12:08:00.000Z"
  }
};
const issued: IssuedSession = {
  sessionId: "30000000-0000-4000-8000-000000000001",
  sessionToken: "s".repeat(43),
  csrfToken: "c".repeat(43),
  expiresAt: identity.expiresAt
};

function verifier(): OidcTokenVerifierPort {
  return { verifyIdToken: async () => identity };
}

function identityLinks(value: string | null = actorId): IdentityLinkPort {
  return {
    resolveActor: async () => (value ? { actorId: value } : null)
  };
}

function memberships(present = true): MembershipPort {
  return {
    resolveMembership: async () =>
      present
        ? {
            actorId,
            tenantId,
            role: "VIEWER",
            verifiedAt: now.toISOString()
          }
        : null
  };
}

function validatingStore(): SessionStorePort {
  return {
    issue: async (input) => {
      const expectedDigest = createHash("sha256").update(idToken).digest("hex");
      if (
        input.actorId !== actorId ||
        input.tenantId !== tenantId ||
        input.oidcTokenHash !== expectedDigest ||
        input.expiresAt !== identity.expiresAt
      ) {
        throw new Error("invalid session issuance input");
      }
      return issued;
    },
    authenticate: async () => {
      throw new Error("not used");
    },
    rotate: async () => issued,
    revoke: async () => undefined
  };
}

function service(
  overrides: {
    link?: IdentityLinkPort;
    membership?: MembershipPort;
    store?: SessionStorePort;
  } = {}
): OidcSessionService {
  return new OidcSessionService({
    verifier: verifier(),
    identityLinkPort: overrides.link ?? identityLinks(),
    membershipPort: overrides.membership ?? memberships(),
    sessionStore: overrides.store ?? validatingStore(),
    maxSessionLifetimeSeconds: 900,
    applicationOrigin: "https://app.example.test",
    clock: () => now
  });
}

describe("OIDC session establishment", () => {
  it("creates an opaque session only after identity mapping and membership", async () => {
    await expect(
      service().establish({
        idToken,
        expectedNonce: "nonce-000000000000000000000000000001",
        tenantId
      })
    ).resolves.toEqual(issued);
  });

  it("fails closed when the OIDC subject has no local actor mapping", async () => {
    const store: SessionStorePort = {
      ...validatingStore(),
      issue: async () => {
        throw new Error("session issuance must not run");
      }
    };
    await expect(
      service({ link: identityLinks(null), store }).establish({
        idToken,
        expectedNonce: "nonce-000000000000000000000000000001",
        tenantId
      })
    ).rejects.toMatchObject({ code: "IDENTITY_LINK_REQUIRED" });
  });

  it("fails closed when the mapped actor is not a tenant member", async () => {
    const store: SessionStorePort = {
      ...validatingStore(),
      issue: async () => {
        throw new Error("session issuance must not run");
      }
    };
    await expect(
      service({ membership: memberships(false), store }).establish({
        idToken,
        expectedNonce: "nonce-000000000000000000000000000001",
        tenantId
      })
    ).rejects.toMatchObject({ code: "MEMBERSHIP_REQUIRED" });
  });

  it("propagates one-time OIDC exchange replay as a typed auth failure", async () => {
    const store: SessionStorePort = {
      ...validatingStore(),
      issue: async () => {
        throw new AuthenticationError("OIDC_TOKEN_REPLAYED");
      }
    };
    await expect(
      service({ store }).establish({
        idToken,
        expectedNonce: "nonce-000000000000000000000000000001",
        tenantId
      })
    ).rejects.toMatchObject({ code: "OIDC_TOKEN_REPLAYED" });
  });

  it("rotates only credentials carried by a same-origin CSRF-protected request", async () => {
    const store: SessionStorePort = {
      ...validatingStore(),
      rotate: async (input) => {
        if (
          input.sessionToken !== issued.sessionToken ||
          input.csrfToken !== issued.csrfToken
        ) {
          throw new Error("invalid rotation input");
        }
        return issued;
      }
    };
    await expect(
      service({ store }).rotateRequest(
        new Request("https://app.example.test/api/auth/session/rotate", {
          method: "POST",
          headers: {
            cookie:
              SESSION_COOKIE_NAME +
              "=" +
              issued.sessionToken +
              "; " +
              CSRF_COOKIE_NAME +
              "=" +
              issued.csrfToken,
            origin: "https://app.example.test",
            "x-csrf-token": issued.csrfToken
          }
        })
      )
    ).resolves.toEqual(issued);
  });

  it("revokes only credentials carried by a same-origin CSRF-protected request", async () => {
    const store: SessionStorePort = {
      ...validatingStore(),
      revoke: async (input) => {
        if (
          input.sessionToken !== issued.sessionToken ||
          input.csrfToken !== issued.csrfToken
        ) {
          throw new Error("invalid revocation input");
        }
      }
    };
    await expect(
      service({ store }).revokeRequest(
        new Request("https://app.example.test/api/auth/session/revoke", {
          method: "POST",
          headers: {
            cookie:
              SESSION_COOKIE_NAME +
              "=" +
              issued.sessionToken +
              "; " +
              CSRF_COOKIE_NAME +
              "=" +
              issued.csrfToken,
            origin: "https://app.example.test",
            "x-csrf-token": issued.csrfToken
          }
        })
      )
    ).resolves.toBeUndefined();
  });
});
