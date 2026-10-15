import { createHash } from "node:crypto";
import {
  AuthenticationError,
  verifiedMembershipSchema,
  type MembershipPort
} from "./auth-port";
import type { OidcTokenVerifierPort, VerifiedOidcIdentity } from "./oidc-port";
import type { IssuedSession, SessionStorePort } from "./session-port";
import { readSessionRequestCredentials } from "../infrastructure/session-cookie";

export interface IdentityLinkPort {
  resolveActor(identity: {
    issuer: string;
    subject: string;
  }): Promise<{ actorId: string } | null>;
}

export interface EstablishOidcSessionInput {
  idToken: string;
  expectedNonce: string;
  tenantId: string;
}

export interface OidcSessionServiceConfiguration {
  verifier: OidcTokenVerifierPort;
  identityLinkPort: IdentityLinkPort;
  membershipPort: MembershipPort;
  sessionStore: SessionStorePort;
  maxSessionLifetimeSeconds: number;
  applicationOrigin: string;
  clock?: () => Date;
}

export class OidcSessionService {
  readonly #verifier: OidcTokenVerifierPort;
  readonly #identityLinkPort: IdentityLinkPort;
  readonly #membershipPort: MembershipPort;
  readonly #sessionStore: SessionStorePort;
  readonly #maxSessionLifetimeSeconds: number;
  readonly #applicationOrigin: string;
  readonly #clock: () => Date;

  constructor(configuration: OidcSessionServiceConfiguration) {
    if (
      !Number.isInteger(configuration.maxSessionLifetimeSeconds) ||
      configuration.maxSessionLifetimeSeconds < 60 ||
      configuration.maxSessionLifetimeSeconds > 86_400
    ) {
      throw new Error("Session lifetime must be between 60 and 86400 seconds");
    }
    this.#verifier = configuration.verifier;
    this.#identityLinkPort = configuration.identityLinkPort;
    this.#membershipPort = configuration.membershipPort;
    this.#sessionStore = configuration.sessionStore;
    this.#maxSessionLifetimeSeconds = configuration.maxSessionLifetimeSeconds;
    const applicationOrigin = new URL(configuration.applicationOrigin);
    if (
      applicationOrigin.protocol !== "https:" ||
      applicationOrigin.origin !== configuration.applicationOrigin
    ) {
      throw new Error("Application origin must be an exact HTTPS origin");
    }
    this.#applicationOrigin = applicationOrigin.origin;
    this.#clock = configuration.clock ?? (() => new Date());
  }

  async establish(input: EstablishOidcSessionInput): Promise<IssuedSession> {
    const now = this.#clock();
    const identity = await this.#verifier.verifyIdToken({
      idToken: input.idToken,
      expectedNonce: input.expectedNonce,
      now
    });
    const link = await this.#identityLinkPort.resolveActor({
      issuer: identity.issuer,
      subject: identity.subject
    });
    if (!link) {
      throw new AuthenticationError("IDENTITY_LINK_REQUIRED");
    }
    const rawMembership = await this.#membershipPort.resolveMembership({
      actorId: link.actorId,
      tenantId: input.tenantId
    });
    const membership = verifiedMembershipSchema.safeParse(rawMembership);
    if (
      !membership.success ||
      membership.data.actorId !== link.actorId ||
      membership.data.tenantId !== input.tenantId
    ) {
      throw new AuthenticationError("MEMBERSHIP_REQUIRED");
    }

    const expiresAt = boundedSessionExpiry(
      identity,
      now,
      this.#maxSessionLifetimeSeconds
    );
    return this.#sessionStore.issue({
      identity,
      actorId: link.actorId,
      tenantId: input.tenantId,
      oidcTokenHash: createHash("sha256").update(input.idToken).digest("hex"),
      expiresAt,
      now
    });
  }

  async rotateRequest(request: Request): Promise<IssuedSession> {
    const credentials = readSessionRequestCredentials(
      request,
      this.#applicationOrigin,
      true
    );
    if (!credentials?.csrfToken) {
      throw new AuthenticationError("AUTHENTICATION_REQUIRED");
    }
    return this.#sessionStore.rotate({
      sessionToken: credentials.sessionToken,
      csrfToken: credentials.csrfToken,
      now: this.#clock()
    });
  }

  async revokeRequest(request: Request): Promise<void> {
    const credentials = readSessionRequestCredentials(
      request,
      this.#applicationOrigin,
      true
    );
    if (!credentials?.csrfToken) {
      throw new AuthenticationError("AUTHENTICATION_REQUIRED");
    }
    await this.#sessionStore.revoke({
      sessionToken: credentials.sessionToken,
      csrfToken: credentials.csrfToken,
      now: this.#clock()
    });
  }
}

function boundedSessionExpiry(
  identity: VerifiedOidcIdentity,
  now: Date,
  maximumLifetimeSeconds: number
): string {
  const oidcExpiry = Date.parse(identity.expiresAt);
  const configuredExpiry = now.getTime() + maximumLifetimeSeconds * 1_000;
  const expiresAt = Math.min(oidcExpiry, configuredExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    throw new AuthenticationError("OIDC_TOKEN_INVALID");
  }
  return new Date(expiresAt).toISOString();
}
