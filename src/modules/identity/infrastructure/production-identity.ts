import type { Sql } from "postgres";
import { z } from "zod";
import {
  AuthenticationError,
  type AuthPort,
  type MembershipPort
} from "../application/auth-port";
import { OidcSessionService } from "../application/oidc-session-service";
import type {
  OidcPublicJwk,
  SupportedOidcAlgorithm
} from "../application/oidc-port";
import { OfflineOidcJwtVerifier } from "./offline-oidc-jwt-verifier";
import { OidcSessionAuthPort } from "./oidc-session-auth-port";
import { PostgresIdentityLinkPort } from "./postgres-identity-link-port";
import { PostgresMembershipPort } from "./postgres-membership-port";
import { PostgresSessionStore } from "./postgres-session-store";
import { parseIdentityDatabaseConfiguration } from "./identity-database";
import { PostgresAuthRateLimiter } from "./postgres-auth-rate-limiter";
import type { AuthRateLimitPort } from "../application/auth-rate-limit-port";

const algorithmSchema = z.enum(["RS256", "ES256"]);
const csvAlgorithms = z.string().transform((value, context) => {
  const values = splitCsv(value);
  const parsed = z.array(algorithmSchema).min(1).max(2).safeParse(values);
  if (!parsed.success || new Set(values).size !== values.length) {
    context.addIssue({
      code: "custom",
      message: "Invalid OIDC algorithm allowlist"
    });
    return z.NEVER;
  }
  return parsed.data;
});
const positiveSeconds = z.coerce.number().int().positive().max(86_400);
const positiveRequestCount = z.coerce.number().int().positive().max(100_000);
const environmentSchema = z
  .strictObject({
    NODE_ENV: z.literal("production"),
    DATABASE_URL: z.string().min(1),
    IDENTITY_DATABASE_URL: z.string().min(1),
    APP_ORIGIN: z.url(),
    OIDC_ISSUER: z.url(),
    OIDC_AUDIENCE: z.string().trim().min(1).max(512),
    OIDC_JWKS_JSON: z.string().min(2).max(131_072),
    OIDC_ALLOWED_ALGORITHMS: csvAlgorithms,
    OIDC_MFA_AMR_VALUES: z.string(),
    OIDC_MFA_ACR_VALUES: z.string(),
    OIDC_CLOCK_SKEW_SECONDS: z.coerce.number().int().min(0).max(300),
    OIDC_MAX_TOKEN_LIFETIME_SECONDS: positiveSeconds,
    OIDC_MAX_MFA_AGE_SECONDS: positiveSeconds,
    SESSION_MAX_LIFETIME_SECONDS: positiveSeconds,
    SESSION_IDLE_TIMEOUT_SECONDS: positiveSeconds,
    AUTH_RATE_LIMIT_HMAC_KEY: z.string().min(1),
    AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveSeconds,
    AUTH_RATE_LIMIT_MAX_REQUESTS: positiveRequestCount,
    AUTH_RATE_LIMIT_GLOBAL_MAX_REQUESTS: positiveRequestCount,
    AUTH_RATE_LIMIT_BLOCK_SECONDS: positiveSeconds
  })
  .refine(
    (configuration) =>
      configuration.SESSION_IDLE_TIMEOUT_SECONDS <=
      configuration.SESSION_MAX_LIFETIME_SECONDS,
    { message: "Idle timeout cannot exceed absolute session lifetime" }
  );
const publicJwkSchema = z
  .object({
    kty: z.enum(["RSA", "EC"]),
    kid: z.string().trim().min(1).max(256),
    alg: algorithmSchema,
    use: z.literal("sig").optional(),
    key_ops: z.array(z.string()).optional()
  })
  .passthrough()
  .refine(
    (key) => !Object.hasOwn(key, "d"),
    "Private JWK material is forbidden"
  );
const jwksSchema = z.strictObject({
  keys: z.array(publicJwkSchema).min(1).max(32)
});

export interface ProductionIdentityServices {
  authPort: AuthPort;
  membershipPort: MembershipPort;
  sessionService: OidcSessionService;
  rateLimiter: AuthRateLimitPort;
}

export function createProductionIdentityServices(
  identitySql: Sql,
  applicationSql: Sql,
  environment: Record<string, string | undefined>,
  clock: () => Date = () => new Date()
): ProductionIdentityServices {
  try {
    const configuration = environmentSchema.parse({
      NODE_ENV: environment.NODE_ENV,
      DATABASE_URL: environment.DATABASE_URL,
      IDENTITY_DATABASE_URL: environment.IDENTITY_DATABASE_URL,
      APP_ORIGIN: environment.APP_ORIGIN,
      OIDC_ISSUER: environment.OIDC_ISSUER,
      OIDC_AUDIENCE: environment.OIDC_AUDIENCE,
      OIDC_JWKS_JSON: environment.OIDC_JWKS_JSON,
      OIDC_ALLOWED_ALGORITHMS: environment.OIDC_ALLOWED_ALGORITHMS,
      OIDC_MFA_AMR_VALUES: environment.OIDC_MFA_AMR_VALUES,
      OIDC_MFA_ACR_VALUES: environment.OIDC_MFA_ACR_VALUES,
      OIDC_CLOCK_SKEW_SECONDS: environment.OIDC_CLOCK_SKEW_SECONDS,
      OIDC_MAX_TOKEN_LIFETIME_SECONDS:
        environment.OIDC_MAX_TOKEN_LIFETIME_SECONDS,
      OIDC_MAX_MFA_AGE_SECONDS: environment.OIDC_MAX_MFA_AGE_SECONDS,
      SESSION_MAX_LIFETIME_SECONDS: environment.SESSION_MAX_LIFETIME_SECONDS,
      SESSION_IDLE_TIMEOUT_SECONDS: environment.SESSION_IDLE_TIMEOUT_SECONDS,
      AUTH_RATE_LIMIT_HMAC_KEY: environment.AUTH_RATE_LIMIT_HMAC_KEY,
      AUTH_RATE_LIMIT_WINDOW_SECONDS:
        environment.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      AUTH_RATE_LIMIT_MAX_REQUESTS: environment.AUTH_RATE_LIMIT_MAX_REQUESTS,
      AUTH_RATE_LIMIT_GLOBAL_MAX_REQUESTS:
        environment.AUTH_RATE_LIMIT_GLOBAL_MAX_REQUESTS,
      AUTH_RATE_LIMIT_BLOCK_SECONDS: environment.AUTH_RATE_LIMIT_BLOCK_SECONDS
    });
    parseIdentityDatabaseConfiguration(environment);
    const applicationOrigin = new URL(configuration.APP_ORIGIN);
    const issuer = new URL(configuration.OIDC_ISSUER);
    const database = new URL(configuration.DATABASE_URL);
    if (
      applicationOrigin.protocol !== "https:" ||
      applicationOrigin.origin !== configuration.APP_ORIGIN ||
      issuer.protocol !== "https:" ||
      issuer.search !== "" ||
      issuer.hash !== "" ||
      !["postgres:", "postgresql:"].includes(database.protocol)
    ) {
      throw new Error("Production identity URLs are invalid");
    }
    const jwks = jwksSchema.parse(JSON.parse(configuration.OIDC_JWKS_JSON));
    const acceptedMfaAmrValues = splitCsv(configuration.OIDC_MFA_AMR_VALUES);
    const acceptedMfaAcrValues = splitCsv(configuration.OIDC_MFA_ACR_VALUES);
    if (
      acceptedMfaAmrValues.length === 0 &&
      acceptedMfaAcrValues.length === 0
    ) {
      throw new Error("At least one production MFA marker is required");
    }

    const verifier = new OfflineOidcJwtVerifier({
      issuer: configuration.OIDC_ISSUER,
      audience: configuration.OIDC_AUDIENCE,
      jwks: { keys: jwks.keys as OidcPublicJwk[] },
      allowedAlgorithms:
        configuration.OIDC_ALLOWED_ALGORITHMS as SupportedOidcAlgorithm[],
      clockSkewSeconds: configuration.OIDC_CLOCK_SKEW_SECONDS,
      maxTokenLifetimeSeconds: configuration.OIDC_MAX_TOKEN_LIFETIME_SECONDS,
      maxMfaAgeSeconds: configuration.OIDC_MAX_MFA_AGE_SECONDS,
      acceptedMfaAmrValues,
      acceptedMfaAcrValues
    });
    const sessionStore = new PostgresSessionStore(identitySql, {
      idleTimeoutSeconds: configuration.SESSION_IDLE_TIMEOUT_SECONDS
    });
    const membershipPort = new PostgresMembershipPort(
      applicationSql,
      clock,
      environment
    );
    const identityLinkPort = new PostgresIdentityLinkPort(identitySql);
    const sessionService = new OidcSessionService({
      verifier,
      identityLinkPort,
      membershipPort,
      sessionStore,
      applicationOrigin: configuration.APP_ORIGIN,
      maxSessionLifetimeSeconds: configuration.SESSION_MAX_LIFETIME_SECONDS,
      clock
    });
    const rateLimiter = new PostgresAuthRateLimiter(identitySql, {
      hmacKey: configuration.AUTH_RATE_LIMIT_HMAC_KEY,
      windowSeconds: configuration.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: configuration.AUTH_RATE_LIMIT_MAX_REQUESTS,
      globalMaxRequests: configuration.AUTH_RATE_LIMIT_GLOBAL_MAX_REQUESTS,
      blockSeconds: configuration.AUTH_RATE_LIMIT_BLOCK_SECONDS
    });
    return {
      authPort: new OidcSessionAuthPort({
        store: sessionStore,
        applicationOrigin: configuration.APP_ORIGIN,
        clock
      }),
      membershipPort,
      sessionService,
      rateLimiter
    };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
}

function splitCsv(value: string): string[] {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return [...new Set(parts)];
}
