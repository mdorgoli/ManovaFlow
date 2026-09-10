import type { VerifiedSession } from "./auth-port";
import type { VerifiedOidcIdentity } from "./oidc-port";

export interface IssuedSession {
  sessionId: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
}

export interface IssueSessionInput {
  identity: VerifiedOidcIdentity;
  actorId: string;
  tenantId: string;
  oidcTokenHash: string;
  expiresAt: string;
  now: Date;
}

export interface AuthenticateSessionInput {
  sessionToken: string;
  requireCsrf: boolean;
  csrfToken?: string;
  now: Date;
}

export interface RotateSessionInput {
  sessionToken: string;
  csrfToken: string;
  now: Date;
}

export interface RevokeSessionInput {
  sessionToken: string;
  csrfToken: string;
  now: Date;
}

export interface SessionStorePort {
  issue(input: IssueSessionInput): Promise<IssuedSession>;
  authenticate(input: AuthenticateSessionInput): Promise<VerifiedSession>;
  rotate(input: RotateSessionInput): Promise<IssuedSession>;
  revoke(input: RevokeSessionInput): Promise<void>;
}

