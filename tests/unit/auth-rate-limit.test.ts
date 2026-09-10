import { describe, expect, it } from "vitest";
import { apiError } from "@/lib/api-response";
import { AuthenticationError } from "@/modules/identity/application/auth-port";
import { deriveRateLimitSubject } from "@/modules/identity/infrastructure/postgres-auth-rate-limiter";
import { SESSION_COOKIE_NAME } from "@/modules/identity/infrastructure/session-cookie";

const hmacKey = Buffer.alloc(32, 7).toString("base64url");

describe("authentication rate-limit boundary", () => {
  it("derives deterministic, operation-bound digests without exposing cookies", () => {
    const cookie = SESSION_COOKIE_NAME + "=" + "s".repeat(43);
    const first = deriveRateLimitSubject({
      hmacKey,
      operation: "SESSION_ROTATE",
      cookieHeader: cookie
    });
    const repeated = deriveRateLimitSubject({
      hmacKey,
      operation: "SESSION_ROTATE",
      cookieHeader: cookie
    });
    const otherOperation = deriveRateLimitSubject({
      hmacKey,
      operation: "SESSION_REVOKE",
      cookieHeader: cookie
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(repeated);
    expect(first).not.toBe(otherOperation);
    expect(first).not.toContain(cookie);
  });

  it("canonicalizes only the valid session cookie across unrelated cookie changes", () => {
    const sessionCookie = SESSION_COOKIE_NAME + "=" + "s".repeat(43);
    const variants = [
      sessionCookie,
      `theme=dark; ${sessionCookie}; locale=fa`,
      `locale=en; tracking=one; ${sessionCookie}; theme=light`,
      `tracking=two; ${sessionCookie}; locale=tr`,
      `theme=dark; ${sessionCookie}; theme=light; locale=fa; locale=tr`
    ];
    const subjects = variants.map((cookieHeader) =>
      deriveRateLimitSubject({
        hmacKey,
        operation: "SESSION_ROTATE",
        cookieHeader
      })
    );

    expect(new Set(subjects).size).toBe(1);
    expect(
      deriveRateLimitSubject({
        hmacKey,
        operation: "SESSION_ROTATE",
        cookieHeader: SESSION_COOKIE_NAME + "=" + "t".repeat(43)
      })
    ).not.toBe(subjects[0]);
  });

  it("maps missing, invalid, oversized, and duplicate session cookies to one fallback bucket", () => {
    const firstToken = "a".repeat(43);
    const secondToken = "b".repeat(43);
    const invalidVariants = [
      null,
      "theme=dark; locale=fa",
      SESSION_COOKIE_NAME + "=short",
      `${SESSION_COOKIE_NAME}=${firstToken}; ${SESSION_COOKIE_NAME}=${secondToken}`,
      `${SESSION_COOKIE_NAME}=${secondToken}; theme=dark; ${SESSION_COOKIE_NAME}=${firstToken}`,
      `padding=${"x".repeat(8_192)}`
    ];
    const subjects = invalidVariants.map((cookieHeader) =>
      deriveRateLimitSubject({
        hmacKey,
        operation: "SESSION_REVOKE",
        cookieHeader
      })
    );

    expect(new Set(subjects).size).toBe(1);
  });

  it.each(["short", "a".repeat(43), "!".repeat(43)])(
    "fails closed for invalid HMAC key material",
    (invalidKey) => {
      expect(() =>
        deriveRateLimitSubject({
          hmacKey: invalidKey,
          operation: "SESSION_ROTATE",
          cookieHeader: "anonymous"
        })
      ).toThrowError(
        expect.objectContaining({ code: "AUTH_PROVIDER_UNAVAILABLE" })
      );
    }
  );

  it("serializes HTTP 429 with an integer Retry-After header", async () => {
    const response = apiError(
      new AuthenticationError("AUTH_RATE_LIMITED", {
        retryAfterSeconds: 17
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Too many authentication requests"
      }
    });
  });
});
