import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true });

export const verifiedOidcIdentitySchema = z.strictObject({
  issuer: z.string().trim().min(1).max(2_048),
  subject: z.string().trim().min(1).max(512),
  issuedAt: timestamp,
  expiresAt: timestamp,
  mfa: z.strictObject({
    method: z.string().trim().min(1).max(160),
    verifiedAt: timestamp,
    expiresAt: timestamp
  })
});

export type VerifiedOidcIdentity = z.infer<typeof verifiedOidcIdentitySchema>;

export interface VerifyIdTokenInput {
  idToken: string;
  expectedNonce: string;
  now?: Date;
}

export interface OidcTokenVerifierPort {
  verifyIdToken(input: VerifyIdTokenInput): Promise<VerifiedOidcIdentity>;
}

export type SupportedOidcAlgorithm = "RS256" | "ES256";

export type OidcPublicJwk = JsonWebKey & {
  kid: string;
  alg?: string;
  use?: string;
  key_ops?: string[];
};

export interface OfflineOidcVerifierConfiguration {
  issuer: string;
  audience: string;
  jwks: { keys: readonly OidcPublicJwk[] };
  allowedAlgorithms: readonly SupportedOidcAlgorithm[];
  clockSkewSeconds: number;
  maxTokenLifetimeSeconds: number;
  maxMfaAgeSeconds: number;
  acceptedMfaAmrValues: readonly string[];
  acceptedMfaAcrValues: readonly string[];
}
