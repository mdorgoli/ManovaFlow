import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { OidcPublicJwk } from "@/modules/identity/application/oidc-port";
import { OfflineOidcJwtVerifier } from "@/modules/identity/infrastructure/offline-oidc-jwt-verifier";

const issuer = "https://identity.example.test";
const audience = "manovaflow-production";
const nonce = "nonce-000000000000000000000000000001";
const now = new Date("2026-09-04T12:00:00.000Z");
const nowSeconds = Math.floor(now.getTime() / 1000);

let privateKey: KeyObject;
let publicJwk: OidcPublicJwk;

beforeAll(() => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = pair.privateKey;
  publicJwk = {
    ...pair.publicKey.export({ format: "jwk" }),
    alg: "RS256",
    kid: "test-signing-key",
    use: "sig"
  };
});

function verifier(): OfflineOidcJwtVerifier {
  return new OfflineOidcJwtVerifier({
    issuer,
    audience,
    jwks: { keys: [publicJwk] },
    allowedAlgorithms: ["RS256"],
    clockSkewSeconds: 30,
    maxTokenLifetimeSeconds: 3_600,
    maxMfaAgeSeconds: 600,
    acceptedMfaAmrValues: ["mfa", "otp"],
    acceptedMfaAcrValues: []
  });
}

function claims(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    iss: issuer,
    aud: audience,
    sub: "provider-subject-001",
    iat: nowSeconds - 60,
    nbf: nowSeconds - 60,
    exp: nowSeconds + 600,
    nonce,
    auth_time: nowSeconds - 120,
    amr: ["pwd", "mfa"],
    ...overrides
  };
}

function jwt(
  payload: Record<string, unknown> = claims(),
  signingKey: KeyObject = privateKey,
  header: Record<string, unknown> = {
    alg: "RS256",
    kid: "test-signing-key",
    typ: "JWT"
  }
): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signingInput = encodedHeader + "." + encodedPayload;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), signingKey);
  return signingInput + "." + signature.toString("base64url");
}

describe("offline provider-neutral OIDC verification", () => {
  it("accepts a locally signed token with exact claims and recent MFA", async () => {
    await expect(
      verifier().verifyIdToken({ idToken: jwt(), expectedNonce: nonce, now })
    ).resolves.toEqual({
      issuer,
      subject: "provider-subject-001",
      issuedAt: "2026-09-04T11:59:00.000Z",
      expiresAt: "2026-09-04T12:10:00.000Z",
      mfa: {
        method: "amr:mfa",
        verifiedAt: "2026-09-04T11:58:00.000Z",
        expiresAt: "2026-09-04T12:08:00.000Z"
      }
    });
  });

  it("accepts an ES256 token only from an explicitly configured P-256 key", async () => {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk: OidcPublicJwk = {
      ...pair.publicKey.export({ format: "jwk" }),
      alg: "ES256",
      kid: "test-ec-signing-key",
      use: "sig"
    };
    const encodedHeader = Buffer.from(
      JSON.stringify({ alg: "ES256", kid: jwk.kid, typ: "JWT" })
    ).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(claims())).toString(
      "base64url"
    );
    const signingInput = encodedHeader + "." + encodedPayload;
    const signature = sign("sha256", Buffer.from(signingInput), {
      key: pair.privateKey,
      dsaEncoding: "ieee-p1363"
    });
    const token = signingInput + "." + signature.toString("base64url");
    const ecVerifier = new OfflineOidcJwtVerifier({
      issuer,
      audience,
      jwks: { keys: [jwk] },
      allowedAlgorithms: ["ES256"],
      clockSkewSeconds: 30,
      maxTokenLifetimeSeconds: 3_600,
      maxMfaAgeSeconds: 600,
      acceptedMfaAmrValues: ["mfa"],
      acceptedMfaAcrValues: []
    });

    await expect(
      ecVerifier.verifyIdToken({ idToken: token, expectedNonce: nonce, now })
    ).resolves.toMatchObject({
      issuer,
      subject: "provider-subject-001",
      mfa: { method: "amr:mfa" }
    });
  });

  it("rejects a token signed by an unconfigured key", async () => {
    const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
    await expect(
      verifier().verifyIdToken({
        idToken: jwt(claims(), attacker.privateKey),
        expectedNonce: nonce,
        now
      })
    ).rejects.toMatchObject({ code: "OIDC_TOKEN_INVALID" });
  });

  it("rejects an unsigned alg=none token", async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", kid: "test-signing-key", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims())).toString("base64url");
    await expect(
      verifier().verifyIdToken({
        idToken: header + "." + payload + ".",
        expectedNonce: nonce,
        now
      })
    ).rejects.toMatchObject({ code: "OIDC_TOKEN_INVALID" });
  });

  it.each([
    ["issuer", { iss: "https://attacker.example.test" }],
    ["audience", { aud: "another-application" }],
    ["authorized party", { aud: [audience, "another"], azp: "another" }],
    ["nonce", { nonce: "attacker-nonce" }],
    ["expiry", { exp: nowSeconds }],
    ["future not-before", { nbf: nowSeconds + 31 }],
    ["future issuance", { iat: nowSeconds + 31 }],
    ["excessive lifetime", { iat: nowSeconds - 60, exp: nowSeconds + 3_541 }]
  ])("rejects an invalid %s claim", async (_name, override) => {
    await expect(
      verifier().verifyIdToken({
        idToken: jwt(claims(override)),
        expectedNonce: nonce,
        now
      })
    ).rejects.toMatchObject({ code: "OIDC_TOKEN_INVALID" });
  });

  it("rejects authentication without configured MFA evidence", async () => {
    await expect(
      verifier().verifyIdToken({
        idToken: jwt(claims({ amr: ["pwd"] })),
        expectedNonce: nonce,
        now
      })
    ).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });

  it("rejects stale MFA even when the token itself has not expired", async () => {
    await expect(
      verifier().verifyIdToken({
        idToken: jwt(claims({ auth_time: nowSeconds - 601 })),
        expectedNonce: nonce,
        now
      })
    ).rejects.toMatchObject({ code: "MFA_EXPIRED" });
  });
});
