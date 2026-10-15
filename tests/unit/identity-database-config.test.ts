import { describe, expect, it } from "vitest";
import { parseIdentityDatabaseConfiguration } from "@/modules/identity/infrastructure/identity-database";

const applicationUrl =
  "postgresql://manovaflow_app_login:application-secret@db.example.test:5432/manovaflow?sslmode=require";
const identityUrl =
  "postgresql://manovaflow_identity_login:identity-secret@db.example.test:5432/manovaflow?sslmode=require";

describe("identity database credential separation", () => {
  it("accepts a distinct login targeting the same primary database", () => {
    expect(
      parseIdentityDatabaseConfiguration({
        DATABASE_URL: applicationUrl,
        IDENTITY_DATABASE_URL: identityUrl
      })
    ).toEqual({ applicationUrl, identityUrl });
  });

  it.each([
    ["missing identity URL", { DATABASE_URL: applicationUrl }],
    [
      "the application username",
      {
        DATABASE_URL: applicationUrl,
        IDENTITY_DATABASE_URL:
          "postgresql://manovaflow_app_login:different-secret@db.example.test:5432/manovaflow"
      }
    ],
    [
      "a different database",
      {
        DATABASE_URL: applicationUrl,
        IDENTITY_DATABASE_URL:
          "postgresql://manovaflow_identity_login:identity-secret@db.example.test:5432/other"
      }
    ]
  ])("fails closed for %s", (_name, environment) => {
    expect(() => parseIdentityDatabaseConfiguration(environment)).toThrowError(
      expect.objectContaining({ code: "AUTH_PROVIDER_UNAVAILABLE" })
    );
  });
});
