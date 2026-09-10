import {
  createPublicKey,
  timingSafeEqual,
  verify as verifySignature
} from "node:crypto";
import { z } from "zod";
import { AuthenticationError } from "../application/auth-port";
import {
  verifiedOidcIdentitySchema,
  type OfflineOidcVerifierConfiguration,
  type OidcPublicJwk,
  type OidcTokenVerifierPort,
  type SupportedOidcAlgorithm,
  type VerifiedOidcIdentity,
  type VerifyIdTokenInput
} from "../application/oidc-port";

const supportedAlgorithmSchema = z.enum(["RS256", "ES256"]);
const positiveSeconds = z.number().int().positive().max(86_400);
const configurationSchema = z
  .strictObject({
    issuer: z.url().max(2_048),
    audience: z.string().trim().min(1).max(512),
    allowedAlgorithms: z.array(supportedAlgorithmSchema).min(1).max(2),
    clockSkewSeconds: z.number().int().min(0).max(300),
    maxTokenLifetimeSeconds: positiveSeconds,
    maxMfaAgeSeconds: positiveSeconds,
    acceptedMfaAmrValues: z.array(z.string().trim().min(1).max(160)).max(20),
    acceptedMfaAcrValues: z.array(z.string().trim().min(1).max(512)).max(20)
  })
  .superRefine((value, context) => {
    if (
      value.acceptedMfaAmrValues.length === 0 &&
      value.acceptedMfaAcrValues.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["acceptedMfaAmrValues"],
        message: "At least one MFA AMR or ACR value is required"
      });
    }
    if (new Set(value.allowedAlgorithms).size !== value.allowedAlgorithms.length) {
      context.addIssue({
        code: "custom",
        path: ["allowedAlgorithms"],
        message: "OIDC algorithms must be unique"
      });
    }
  });

const protectedHeaderSchema = z
  .object({
    alg: supportedAlgorithmSchema,
    kid: z.string().trim().min(1).max(256),
    typ: z.literal("JWT").optional()
  })
  .passthrough();

const numericDate = z.number().finite().int().nonnegative();
const claimsSchema = z
  .object({
    iss: z.string().min(1).max(2_048),
    aud: z.union([
      z.string().min(1).max(512),
      z.array(z.string().min(1).max(512)).min(1).max(20)
    ]),
    azp: z.string().min(1).max(512).optional(),
    sub: z.string().min(1).max(512),
    iat: numericDate,
    nbf: numericDate.optional(),
    exp: numericDate,
    nonce: z.string().min(16).max(512),
    auth_time: numericDate,
    amr: z.array(z.string().min(1).max(160)).max(20).optional(),
    acr: z.string().min(1).max(512).optional()
  })
  .passthrough();

export class OfflineOidcJwtVerifier implements OidcTokenVerifierPort {
  readonly #configuration: z.infer<typeof configurationSchema>;
  readonly #keys: readonly OidcPublicJwk[];

  constructor(configuration: OfflineOidcVerifierConfiguration) {
    this.#configuration = configurationSchema.parse({
      issuer: configuration.issuer,
      audience: configuration.audience,
      allowedAlgorithms: [...configuration.allowedAlgorithms],
      clockSkewSeconds: configuration.clockSkewSeconds,
      maxTokenLifetimeSeconds: configuration.maxTokenLifetimeSeconds,
      maxMfaAgeSeconds: configuration.maxMfaAgeSeconds,
      acceptedMfaAmrValues: [...configuration.acceptedMfaAmrValues],
      acceptedMfaAcrValues: [...configuration.acceptedMfaAcrValues]
    });
    if (!Array.isArray(configuration.jwks.keys) || configuration.jwks.keys.length === 0) {
      throw new Error("At least one static OIDC public key is required");
    }
    this.#keys = Object.freeze([...configuration.jwks.keys]);
  }

  async verifyIdToken(input: VerifyIdTokenInput): Promise<VerifiedOidcIdentity> {
    try {
      return this.#verify(input);
    } catch (error) {
      if (
        error instanceof AuthenticationError &&
        (error.code === "MFA_REQUIRED" || error.code === "MFA_EXPIRED")
      ) {
        throw error;
      }
      throw new AuthenticationError("OIDC_TOKEN_INVALID");
    }
  }

  #verify(input: VerifyIdTokenInput): VerifiedOidcIdentity {
    if (
      input.idToken.length < 32 ||
      input.idToken.length > 16_384 ||
      input.expectedNonce.length < 16 ||
      input.expectedNonce.length > 512
    ) {
      throw new Error("Invalid OIDC token input");
    }

    const segments = input.idToken.split(".");
    if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
      throw new Error("OIDC token must be a signed compact JWS");
    }
    const [encodedHeader, encodedClaims, encodedSignature] = segments as [
      string,
      string,
      string
    ];
    const header = protectedHeaderSchema.parse(parseJsonSegment(encodedHeader));
    if (
      !(this.#configuration.allowedAlgorithms as SupportedOidcAlgorithm[]).includes(
        header.alg
      ) ||
      Object.hasOwn(header, "crit") ||
      Object.hasOwn(header, "b64")
    ) {
      throw new Error("Unsupported OIDC protected header");
    }

    const matches = this.#keys.filter((key) => isEligibleKey(key, header.kid, header.alg));
    if (matches.length !== 1) {
      throw new Error("OIDC signing key is missing or ambiguous");
    }
    const publicKey = createPublicKey({ key: matches[0]!, format: "jwk" });
    const signature = decodeBase64Url(encodedSignature);
    const signingInput = Buffer.from(encodedHeader + "." + encodedClaims, "ascii");
    const validSignature =
      header.alg === "RS256"
        ? verifySignature("RSA-SHA256", signingInput, publicKey, signature)
        : verifySignature(
            "sha256",
            signingInput,
            { key: publicKey, dsaEncoding: "ieee-p1363" },
            signature
          );
    if (!validSignature) {
      throw new Error("OIDC signature verification failed");
    }

    const claims = claimsSchema.parse(parseJsonSegment(encodedClaims));
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000);
    const skew = this.#configuration.clockSkewSeconds;
    if (claims.iss !== this.#configuration.issuer) {
      throw new Error("OIDC issuer mismatch");
    }
    validateAudience(claims.aud, claims.azp, this.#configuration.audience);
    if (!constantTimeEqual(claims.nonce, input.expectedNonce)) {
      throw new Error("OIDC nonce mismatch");
    }
    if (
      claims.exp <= nowSeconds ||
      claims.exp <= claims.iat ||
      claims.iat > nowSeconds + skew ||
      (claims.nbf !== undefined && claims.nbf > nowSeconds + skew) ||
      claims.exp - claims.iat > this.#configuration.maxTokenLifetimeSeconds ||
      claims.auth_time > nowSeconds + skew
    ) {
      throw new Error("OIDC token timing is invalid");
    }

    const method = resolveMfaMethod(
      claims.amr ?? [],
      claims.acr,
      this.#configuration.acceptedMfaAmrValues,
      this.#configuration.acceptedMfaAcrValues
    );
    if (!method) {
      throw new AuthenticationError("MFA_REQUIRED");
    }
    if (nowSeconds - claims.auth_time > this.#configuration.maxMfaAgeSeconds) {
      throw new AuthenticationError("MFA_EXPIRED");
    }
    const mfaExpiresAt = Math.min(
      claims.exp,
      claims.auth_time + this.#configuration.maxMfaAgeSeconds
    );

    return verifiedOidcIdentitySchema.parse({
      issuer: claims.iss,
      subject: claims.sub,
      issuedAt: new Date(claims.iat * 1_000).toISOString(),
      expiresAt: new Date(claims.exp * 1_000).toISOString(),
      mfa: {
        method,
        verifiedAt: new Date(claims.auth_time * 1_000).toISOString(),
        expiresAt: new Date(mfaExpiresAt * 1_000).toISOString()
      }
    });
  }
}

function parseJsonSegment(encoded: string): unknown {
  const decoded = decodeBase64Url(encoded);
  const value: unknown = JSON.parse(decoded.toString("utf8"));
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JWT segment must contain a JSON object");
  }
  return value;
}

function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid base64url encoding");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== value) {
    throw new Error("Non-canonical base64url encoding");
  }
  return decoded;
}

function isEligibleKey(
  key: OidcPublicJwk,
  kid: string,
  algorithm: SupportedOidcAlgorithm
): boolean {
  if (
    key.kid !== kid ||
    (key.alg !== undefined && key.alg !== algorithm) ||
    (key.use !== undefined && key.use !== "sig") ||
    (key.key_ops !== undefined && !key.key_ops.includes("verify")) ||
    key.d !== undefined
  ) {
    return false;
  }
  if (algorithm === "RS256") return key.kty === "RSA";
  return key.kty === "EC" && key.crv === "P-256";
}

function validateAudience(
  claim: string | string[],
  authorizedParty: string | undefined,
  expected: string
): void {
  if (typeof claim === "string") {
    if (claim !== expected) throw new Error("OIDC audience mismatch");
    return;
  }
  if (!claim.includes(expected)) throw new Error("OIDC audience mismatch");
  if (claim.length > 1 && authorizedParty !== expected) {
    throw new Error("OIDC authorized party mismatch");
  }
}

function resolveMfaMethod(
  amr: readonly string[],
  acr: string | undefined,
  acceptedAmr: readonly string[],
  acceptedAcr: readonly string[]
): string | null {
  const matchedAmr = amr.find((value) => acceptedAmr.includes(value));
  if (matchedAmr) return "amr:" + matchedAmr;
  if (acr && acceptedAcr.includes(acr)) return "acr:" + acr;
  return null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
