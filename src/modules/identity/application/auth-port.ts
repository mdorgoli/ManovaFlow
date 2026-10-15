import { z } from "zod";
import { ROLES, type ActorContext } from "@/modules/growth/domain/types";

export const FORBIDDEN_IDENTITY_HEADERS = [
  "x-tenant-id",
  "x-actor-id",
  "x-role",
  "x-session-id",
  "x-mfa-verified",
  "x-auth-subject"
] as const;

const timestamp = z.iso.datetime({ offset: true });

export const verifiedSessionSchema = z.strictObject({
  source: z.enum(["SERVER_VERIFIED_SESSION", "DEMO_SERVER_CONTEXT"]),
  sessionId: z.string().trim().min(16).max(256),
  actorId: z.uuid(),
  activeTenantId: z.uuid(),
  issuedAt: timestamp,
  expiresAt: timestamp,
  mfa: z
    .strictObject({
      method: z.string().trim().min(1).max(80),
      verifiedAt: timestamp,
      expiresAt: timestamp
    })
    .nullable()
});

export type VerifiedSession = z.infer<typeof verifiedSessionSchema>;

export const verifiedMembershipSchema = z.strictObject({
  tenantId: z.uuid(),
  actorId: z.uuid(),
  role: z.enum(ROLES),
  verifiedAt: timestamp
});

export type VerifiedMembership = z.infer<typeof verifiedMembershipSchema>;

export interface AuthPort {
  resolveSession(request: Request): Promise<VerifiedSession | null>;
}

export interface MembershipPort {
  resolveMembership(identity: {
    actorId: string;
    tenantId: string;
  }): Promise<VerifiedMembership | null>;
}

export type AuthenticationErrorCode =
  | "AUTH_PROVIDER_UNAVAILABLE"
  | "AUTHORIZATION_SERVICE_UNAVAILABLE"
  | "AUTHENTICATION_REQUIRED"
  | "AUTH_RATE_LIMITED"
  | "OIDC_TOKEN_INVALID"
  | "OIDC_TOKEN_REPLAYED"
  | "IDENTITY_LINK_REQUIRED"
  | "INVALID_SESSION"
  | "SESSION_EXPIRED"
  | "SESSION_IDLE_TIMEOUT"
  | "SESSION_REVOKED"
  | "SESSION_REPLAY_DETECTED"
  | "MFA_REQUIRED"
  | "MFA_EXPIRED"
  | "CSRF_VALIDATION_FAILED"
  | "ORIGIN_VALIDATION_FAILED"
  | "DEMO_SESSION_FORBIDDEN"
  | "MEMBERSHIP_REQUIRED"
  | "INVALID_MEMBERSHIP"
  | "IDENTITY_SPOOFING_DETECTED";

const errorStatus: Readonly<Record<AuthenticationErrorCode, number>> = {
  AUTH_PROVIDER_UNAVAILABLE: 503,
  AUTHORIZATION_SERVICE_UNAVAILABLE: 503,
  AUTHENTICATION_REQUIRED: 401,
  AUTH_RATE_LIMITED: 429,
  OIDC_TOKEN_INVALID: 401,
  OIDC_TOKEN_REPLAYED: 401,
  IDENTITY_LINK_REQUIRED: 403,
  INVALID_SESSION: 401,
  SESSION_EXPIRED: 401,
  SESSION_IDLE_TIMEOUT: 401,
  SESSION_REVOKED: 401,
  SESSION_REPLAY_DETECTED: 401,
  MFA_REQUIRED: 403,
  MFA_EXPIRED: 403,
  CSRF_VALIDATION_FAILED: 403,
  ORIGIN_VALIDATION_FAILED: 403,
  DEMO_SESSION_FORBIDDEN: 403,
  MEMBERSHIP_REQUIRED: 403,
  INVALID_MEMBERSHIP: 403,
  IDENTITY_SPOOFING_DETECTED: 400
};

const errorMessage: Readonly<Record<AuthenticationErrorCode, string>> = {
  AUTH_PROVIDER_UNAVAILABLE: "Authentication service is unavailable",
  AUTHORIZATION_SERVICE_UNAVAILABLE: "Authorization service is unavailable",
  AUTHENTICATION_REQUIRED: "Authentication is required",
  AUTH_RATE_LIMITED: "Too many authentication requests",
  OIDC_TOKEN_INVALID: "The identity token is invalid",
  OIDC_TOKEN_REPLAYED: "The identity token has already been used",
  IDENTITY_LINK_REQUIRED: "The identity is not linked to a local actor",
  INVALID_SESSION: "The authenticated session is invalid",
  SESSION_EXPIRED: "The authenticated session has expired",
  SESSION_IDLE_TIMEOUT: "The authenticated session timed out after inactivity",
  SESSION_REVOKED: "The authenticated session has been revoked",
  SESSION_REPLAY_DETECTED: "Session credential replay was detected",
  MFA_REQUIRED: "Current multi-factor authentication is required",
  MFA_EXPIRED: "Multi-factor authentication has expired",
  CSRF_VALIDATION_FAILED: "CSRF validation failed",
  ORIGIN_VALIDATION_FAILED: "Request origin validation failed",
  DEMO_SESSION_FORBIDDEN: "Demo authentication is forbidden in production",
  MEMBERSHIP_REQUIRED: "An active tenant membership is required",
  INVALID_MEMBERSHIP: "The tenant membership is invalid",
  IDENTITY_SPOOFING_DETECTED: "Client-controlled identity headers are forbidden"
};

export class AuthenticationError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    readonly code: AuthenticationErrorCode,
    options?: { retryAfterSeconds?: number }
  ) {
    super(errorMessage[code]);
    this.name = "AuthenticationError";
    this.status = errorStatus[code];
    if (code === "AUTH_RATE_LIMITED") {
      const retryAfterSeconds = options?.retryAfterSeconds;
      if (
        !Number.isInteger(retryAfterSeconds) ||
        retryAfterSeconds === undefined ||
        retryAfterSeconds < 1 ||
        retryAfterSeconds > 86_400
      ) {
        throw new Error("Rate-limit retry delay is invalid");
      }
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
}

export interface AuthenticationPolicy {
  environment: "production" | "non-production";
  now?: Date;
  requireMfa?: boolean;
  clockSkewMs?: number;
}

export interface AuthenticateRequestInput {
  request: Request;
  authPort: AuthPort;
  membershipPort: MembershipPort;
  policy: AuthenticationPolicy;
}

export async function authenticateRequest(
  input: AuthenticateRequestInput
): Promise<ActorContext> {
  rejectClientIdentityHeaders(input.request.headers);

  let rawSession: VerifiedSession | null;
  try {
    rawSession = await input.authPort.resolveSession(input.request);
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }

  if (!rawSession) {
    throw new AuthenticationError("AUTHENTICATION_REQUIRED");
  }

  const parsed = verifiedSessionSchema.safeParse(rawSession);
  if (!parsed.success) {
    throw new AuthenticationError("INVALID_SESSION");
  }

  const session = parsed.data;
  const now = input.policy.now ?? new Date();
  const skew = input.policy.clockSkewMs ?? 60_000;
  const nowMs = now.getTime();
  const issuedAtMs = Date.parse(session.issuedAt);
  const expiresAtMs = Date.parse(session.expiresAt);

  if (issuedAtMs > nowMs + skew || expiresAtMs <= issuedAtMs) {
    throw new AuthenticationError("INVALID_SESSION");
  }
  if (expiresAtMs <= nowMs) {
    throw new AuthenticationError("SESSION_EXPIRED");
  }
  if (
    input.policy.environment === "production" &&
    session.source !== "SERVER_VERIFIED_SESSION"
  ) {
    throw new AuthenticationError("DEMO_SESSION_FORBIDDEN");
  }

  const requiresMfa =
    input.policy.environment === "production" ||
    input.policy.requireMfa === true;
  if (requiresMfa) {
    if (!session.mfa) {
      throw new AuthenticationError("MFA_REQUIRED");
    }
    const mfaVerifiedAtMs = Date.parse(session.mfa.verifiedAt);
    const mfaExpiresAtMs = Date.parse(session.mfa.expiresAt);
    if (mfaVerifiedAtMs > nowMs + skew || mfaExpiresAtMs <= mfaVerifiedAtMs) {
      throw new AuthenticationError("INVALID_SESSION");
    }
    if (mfaExpiresAtMs <= nowMs) {
      throw new AuthenticationError("MFA_EXPIRED");
    }
  }

  let rawMembership: VerifiedMembership | null;
  try {
    rawMembership = await input.membershipPort.resolveMembership({
      actorId: session.actorId,
      tenantId: session.activeTenantId
    });
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("AUTHORIZATION_SERVICE_UNAVAILABLE");
  }
  if (!rawMembership) {
    throw new AuthenticationError("MEMBERSHIP_REQUIRED");
  }
  const parsedMembership = verifiedMembershipSchema.safeParse(rawMembership);
  if (!parsedMembership.success) {
    throw new AuthenticationError("INVALID_MEMBERSHIP");
  }
  const membership = parsedMembership.data;
  if (
    membership.actorId !== session.actorId ||
    membership.tenantId !== session.activeTenantId ||
    Date.parse(membership.verifiedAt) > nowMs + skew
  ) {
    throw new AuthenticationError("INVALID_MEMBERSHIP");
  }

  return Object.freeze({
    tenantId: membership.tenantId,
    actorId: session.actorId,
    role: membership.role
  });
}

export function rejectClientIdentityHeaders(headers: Headers): void {
  for (const header of FORBIDDEN_IDENTITY_HEADERS) {
    if (headers.has(header)) {
      throw new AuthenticationError("IDENTITY_SPOOFING_DETECTED");
    }
  }
}
