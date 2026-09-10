import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  calls: [] as string[],
  block: false
}));

vi.mock("@/lib/container", () => ({
  getDatabaseClient: () => ({}),
  getIdentityDatabaseClient: () => ({})
}));

vi.mock(
  "@/modules/identity/infrastructure/production-identity",
  async () => {
    const { AuthenticationError } = await import(
      "@/modules/identity/application/auth-port"
    );
    return {
      createProductionIdentityServices: () => ({
        rateLimiter: {
          consume: async (input: { operation: string }) => {
            state.calls.push(`limit:${input.operation}`);
            if (state.block) {
              throw new AuthenticationError("AUTH_RATE_LIMITED", {
                retryAfterSeconds: 11
              });
            }
          }
        },
        sessionService: {
          rotateRequest: async () => {
            state.calls.push("session:rotate");
            return {
              sessionId: "30000000-0000-4000-8000-000000000001",
              sessionToken: "s".repeat(43),
              csrfToken: "c".repeat(43),
              expiresAt: "2099-09-04T13:15:00.000Z"
            };
          },
          revokeRequest: async () => {
            state.calls.push("session:revoke");
          }
        }
      })
    };
  }
);

import { POST as rotateSession } from "@/app/api/auth/session/rotate/route";
import { POST as revokeSession } from "@/app/api/auth/session/revoke/route";

beforeEach(() => {
  state.calls.length = 0;
  state.block = false;
});

describe("session lifecycle route throttling", () => {
  it("consumes the operation limit before rotating or revoking", async () => {
    await rotateSession(
      new Request("https://app.example.test/api/auth/session/rotate", {
        method: "POST"
      })
    );
    expect(state.calls).toEqual([
      "limit:SESSION_ROTATE",
      "session:rotate"
    ]);

    state.calls.length = 0;
    await revokeSession(
      new Request("https://app.example.test/api/auth/session/revoke", {
        method: "POST"
      })
    );
    expect(state.calls).toEqual([
      "limit:SESSION_REVOKE",
      "session:revoke"
    ]);
  });

  it("does not touch session state when the limiter blocks", async () => {
    state.block = true;
    const response = await rotateSession(
      new Request("https://app.example.test/api/auth/session/rotate", {
        method: "POST"
      })
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("11");
    expect(state.calls).toEqual(["limit:SESSION_ROTATE"]);
  });
});
