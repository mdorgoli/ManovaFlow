import { describe, expect, it } from "vitest";
import type {
  IssuedSession,
  SessionStorePort
} from "@/modules/identity/application/session-port";
import { OidcSessionAuthPort } from "@/modules/identity/infrastructure/oidc-session-auth-port";
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  serializeClearedSessionCookies,
  serializeIssuedSessionCookies
} from "@/modules/identity/infrastructure/session-cookie";

const now = new Date("2026-09-04T12:00:00.000Z");
const sessionToken = "s".repeat(43);
const csrfToken = "c".repeat(43);
const issued: IssuedSession = {
  sessionId: "30000000-0000-4000-8000-000000000001",
  sessionToken,
  csrfToken,
  expiresAt: "2026-09-04T12:10:00.000Z"
};

const verifiedSession = {
  source: "SERVER_VERIFIED_SESSION" as const,
  sessionId: issued.sessionId,
  actorId: "20000000-0000-4000-8000-000000000001",
  activeTenantId: "10000000-0000-4000-8000-000000000001",
  issuedAt: "2026-09-04T11:59:00.000Z",
  expiresAt: issued.expiresAt,
  mfa: {
    method: "amr:mfa",
    verifiedAt: "2026-09-04T11:58:00.000Z",
    expiresAt: "2026-09-04T12:08:00.000Z"
  }
};

function realBoundaryStore(): SessionStorePort {
  return {
    issue: async () => issued,
    authenticate: async (input) => {
      if (input.sessionToken !== sessionToken) {
        throw new Error("unexpected session token");
      }
      if (input.requireCsrf && input.csrfToken !== csrfToken) {
        throw new Error("unexpected CSRF token");
      }
      return verifiedSession;
    },
    rotate: async () => issued,
    revoke: async () => undefined
  };
}

function cookieHeader(includeCsrf = true): string {
  const values = [SESSION_COOKIE_NAME + "=" + sessionToken];
  if (includeCsrf) values.push(CSRF_COOKIE_NAME + "=" + csrfToken);
  return values.join("; ");
}

describe("opaque session cookie boundary", () => {
  it("serializes hardened host-only session and CSRF cookies", () => {
    expect(serializeIssuedSessionCookies(issued, now)).toEqual([
      SESSION_COOKIE_NAME +
        "=" +
        sessionToken +
        "; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Strict",
      CSRF_COOKIE_NAME +
        "=" +
        csrfToken +
        "; Path=/; Max-Age=600; Secure; SameSite=Strict"
    ]);
  });

  it("serializes immediate cookie clearing without a Domain attribute", () => {
    expect(serializeClearedSessionCookies()).toEqual([
      SESSION_COOKIE_NAME +
        "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
      CSRF_COOKIE_NAME + "=; Path=/; Max-Age=0; Secure; SameSite=Strict"
    ]);
  });

  it("authenticates a safe request from the opaque HttpOnly cookie", async () => {
    const port = new OidcSessionAuthPort({
      store: realBoundaryStore(),
      applicationOrigin: "https://app.example.test",
      clock: () => now
    });
    await expect(
      port.resolveSession(
        new Request("https://app.example.test/api/dashboard", {
          headers: { cookie: cookieHeader(false) }
        })
      )
    ).resolves.toEqual(verifiedSession);
  });

  it("authenticates an unsafe request only with bound CSRF and exact Origin", async () => {
    const port = new OidcSessionAuthPort({
      store: realBoundaryStore(),
      applicationOrigin: "https://app.example.test",
      clock: () => now
    });
    await expect(
      port.resolveSession(
        new Request("https://app.example.test/api/research/run", {
          method: "POST",
          headers: {
            cookie: cookieHeader(),
            origin: "https://app.example.test",
            "x-csrf-token": csrfToken
          }
        })
      )
    ).resolves.toEqual(verifiedSession);
  });

  it.each([
    [
      "missing Origin",
      { cookie: cookieHeader(), "x-csrf-token": csrfToken },
      "ORIGIN_VALIDATION_FAILED"
    ],
    [
      "wrong Origin",
      {
        cookie: cookieHeader(),
        origin: "https://attacker.example.test",
        "x-csrf-token": csrfToken
      },
      "ORIGIN_VALIDATION_FAILED"
    ],
    [
      "missing CSRF header",
      { cookie: cookieHeader(), origin: "https://app.example.test" },
      "CSRF_VALIDATION_FAILED"
    ],
    [
      "mismatched CSRF header",
      {
        cookie: cookieHeader(),
        origin: "https://app.example.test",
        "x-csrf-token": "x".repeat(43)
      },
      "CSRF_VALIDATION_FAILED"
    ]
  ])("rejects an unsafe request with %s", async (_name, headers, code) => {
    const port = new OidcSessionAuthPort({
      store: realBoundaryStore(),
      applicationOrigin: "https://app.example.test",
      clock: () => now
    });
    await expect(
      port.resolveSession(
        new Request("https://app.example.test/api/research/run", {
          method: "POST",
          headers
        })
      )
    ).rejects.toMatchObject({ code });
  });

  it("rejects duplicate session cookies instead of choosing one", async () => {
    const port = new OidcSessionAuthPort({
      store: realBoundaryStore(),
      applicationOrigin: "https://app.example.test",
      clock: () => now
    });
    await expect(
      port.resolveSession(
        new Request("https://app.example.test/api/dashboard", {
          headers: {
            cookie:
              SESSION_COOKIE_NAME +
              "=" +
              sessionToken +
              "; " +
              SESSION_COOKIE_NAME +
              "=" +
              "a".repeat(43)
          }
        })
      )
    ).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });

  it("rejects an oversized cookie header even when it contains a valid session token", async () => {
    const port = new OidcSessionAuthPort({
      store: realBoundaryStore(),
      applicationOrigin: "https://app.example.test",
      clock: () => now
    });
    await expect(
      port.resolveSession(
        new Request("https://app.example.test/api/dashboard", {
          headers: {
            cookie:
              SESSION_COOKIE_NAME +
              "=" +
              sessionToken +
              "; padding=" +
              "x".repeat(8_192)
          }
        })
      )
    ).rejects.toMatchObject({ code: "INVALID_SESSION" });
  });
});
