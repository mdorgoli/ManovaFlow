import { generateKeyPairSync } from "node:crypto";
import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import { resolveRequestActor } from "@/lib/request-auth";

const demoEnvironment = {
  NODE_ENV: "development",
  DEMO_MODE: "true",
  DEMO_TENANT_ID: "10000000-0000-4000-8000-000000000001",
  DEMO_ACTOR_ID: "20000000-0000-4000-8000-000000000001",
  DEMO_ACTOR_ROLE: "OWNER"
};

const signingPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const productionJwk = {
  ...signingPair.publicKey.export({ format: "jwk" }),
  alg: "RS256",
  kid: "production-test-key",
  use: "sig"
};

function productionEnvironment() {
  return {
    ...demoEnvironment,
    NODE_ENV: "production",
    DATABASE_URL:
      "postgresql://application_login:secret@unused.example.test/manovaflow",
    IDENTITY_DATABASE_URL:
      "postgresql://identity_login:secret@unused.example.test/manovaflow",
    APP_ORIGIN: "https://app.example.test",
    OIDC_ISSUER: "https://identity.example.test",
    OIDC_AUDIENCE: "manovaflow-production",
    OIDC_JWKS_JSON: JSON.stringify({ keys: [productionJwk] }),
    OIDC_ALLOWED_ALGORITHMS: "RS256",
    OIDC_MFA_AMR_VALUES: "mfa,otp",
    OIDC_MFA_ACR_VALUES: "",
    OIDC_CLOCK_SKEW_SECONDS: "30",
    OIDC_MAX_TOKEN_LIFETIME_SECONDS: "3600",
    OIDC_MAX_MFA_AGE_SECONDS: "600",
    SESSION_MAX_LIFETIME_SECONDS: "900",
    SESSION_IDLE_TIMEOUT_SECONDS: "300",
    AUTH_RATE_LIMIT_HMAC_KEY: Buffer.alloc(32, 9).toString("base64url"),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: "60",
    AUTH_RATE_LIMIT_MAX_REQUESTS: "10",
    AUTH_RATE_LIMIT_GLOBAL_MAX_REQUESTS: "100",
    AUTH_RATE_LIMIT_BLOCK_SECONDS: "60"
  };
}

describe("server request authentication wiring", () => {
  it("permits explicit local demo identity without presenting it as production MFA", async () => {
    await expect(
      resolveRequestActor(
        new Request("http://127.0.0.1/api/dashboard"),
        demoEnvironment,
        new Date("2026-09-04T08:00:00.000Z")
      )
    ).resolves.toEqual({
      tenantId: demoEnvironment.DEMO_TENANT_ID,
      actorId: demoEnvironment.DEMO_ACTOR_ID,
      role: "OWNER"
    });
  });

  it("fails closed in production when no real authentication adapter is installed", async () => {
    await expect(
      resolveRequestActor(
        new Request("https://app.example/api/dashboard"),
        { ...demoEnvironment, NODE_ENV: "production" },
        new Date("2026-09-04T08:00:00.000Z")
      )
    ).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
  });

  it("selects opaque-session authentication only with complete production OIDC config", async () => {
    await expect(
      resolveRequestActor(
        new Request("https://app.example.test/api/dashboard"),
        productionEnvironment(),
        new Date("2026-09-04T12:00:00.000Z"),
        {} as Sql,
        {} as Sql
      )
    ).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("fails closed when the production identity database credential is missing", async () => {
    await expect(
      resolveRequestActor(
        new Request("https://app.example.test/api/dashboard"),
        { ...productionEnvironment(), IDENTITY_DATABASE_URL: undefined },
        new Date("2026-09-04T12:00:00.000Z"),
        {} as Sql,
        {} as Sql
      )
    ).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
  });

  it("fails closed when application and identity database credentials share a username", async () => {
    await expect(
      resolveRequestActor(
        new Request("https://app.example.test/api/dashboard"),
        {
          ...productionEnvironment(),
          IDENTITY_DATABASE_URL:
            "postgresql://application_login:different@unused.example.test/manovaflow"
        },
        new Date("2026-09-04T12:00:00.000Z"),
        {} as Sql,
        {} as Sql
      )
    ).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
  });

  it("fails closed when rate-limit secret configuration is incomplete", async () => {
    await expect(
      resolveRequestActor(
        new Request("https://app.example.test/api/dashboard"),
        { ...productionEnvironment(), AUTH_RATE_LIMIT_HMAC_KEY: undefined },
        new Date("2026-09-04T12:00:00.000Z"),
        {} as Sql,
        {} as Sql
      )
    ).rejects.toMatchObject({ code: "AUTH_PROVIDER_UNAVAILABLE" });
  });
});
