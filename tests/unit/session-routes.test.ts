import { afterEach, describe, expect, it } from "vitest";
import { POST as rotateSession } from "@/app/api/auth/session/rotate/route";
import { POST as revokeSession } from "@/app/api/auth/session/revoke/route";

const previousDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

describe("production session lifecycle routes", () => {
  it.each([
    ["rotate", rotateSession],
    ["revoke", revokeSession]
  ])(
    "fails %s closed without exposing database configuration errors",
    async (_name, handler) => {
      delete process.env.DATABASE_URL;
      const response = await handler(
        new Request("https://app.example.test/api/auth/session/" + _name, {
          method: "POST"
        })
      );

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "AUTH_PROVIDER_UNAVAILABLE",
          message: "Authentication service is unavailable"
        }
      });
    }
  );
});
