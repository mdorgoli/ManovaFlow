import { z } from "zod";
import type { ActorContext } from "@/modules/growth/domain/types";
import {
  AuthenticationError,
  type AuthPort,
  type MembershipPort,
  type VerifiedMembership,
  type VerifiedSession
} from "../application/auth-port";

const demoIdentitySchema = z.strictObject({
  DEMO_TENANT_ID: z.uuid(),
  DEMO_ACTOR_ID: z.uuid(),
  DEMO_ACTOR_ROLE: z.enum(["OWNER", "OPERATOR", "VIEWER"])
});

export class FailClosedAuthPort implements AuthPort {
  async resolveSession(_request: Request): Promise<never> {
    void _request;
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
}

export class DemoAuthPort implements AuthPort {
  readonly #actor: ActorContext;
  readonly #clock: () => Date;

  constructor(
    environment: Record<string, string | undefined>,
    clock: () => Date = () => new Date()
  ) {
    this.#actor = parseDemoActor(environment);
    this.#clock = clock;
  }

  async resolveSession(_request: Request): Promise<VerifiedSession> {
    void _request;
    const now = this.#clock();
    return {
      source: "DEMO_SERVER_CONTEXT",
      sessionId: "demo-session-" + this.#actor.actorId,
      actorId: this.#actor.actorId,
      activeTenantId: this.#actor.tenantId,
      issuedAt: new Date(now.getTime() - 1_000).toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
      mfa: null
    };
  }
}

export class DemoMembershipPort implements MembershipPort {
  readonly #actor: ActorContext;
  readonly #clock: () => Date;

  constructor(
    environment: Record<string, string | undefined>,
    clock: () => Date = () => new Date()
  ) {
    this.#actor = parseDemoActor(environment);
    this.#clock = clock;
  }

  async resolveMembership(identity: {
    actorId: string;
    tenantId: string;
  }): Promise<VerifiedMembership | null> {
    if (
      identity.actorId !== this.#actor.actorId ||
      identity.tenantId !== this.#actor.tenantId
    ) {
      return null;
    }
    return {
      tenantId: this.#actor.tenantId,
      actorId: this.#actor.actorId,
      role: this.#actor.role,
      verifiedAt: this.#clock().toISOString()
    };
  }
}

export class FailClosedMembershipPort implements MembershipPort {
  async resolveMembership(_identity: {
    actorId: string;
    tenantId: string;
  }): Promise<never> {
    void _identity;
    throw new AuthenticationError("AUTHORIZATION_SERVICE_UNAVAILABLE");
  }
}

export function createDefaultAuthPort(
  environment: Record<string, string | undefined>,
  clock: () => Date = () => new Date()
): AuthPort {
  if (
    environment.NODE_ENV !== "production" &&
    environment.DEMO_MODE === "true"
  ) {
    return new DemoAuthPort(environment, clock);
  }
  return new FailClosedAuthPort();
}

export function createDefaultMembershipPort(
  environment: Record<string, string | undefined>,
  clock: () => Date = () => new Date()
): MembershipPort {
  if (
    environment.NODE_ENV !== "production" &&
    environment.DEMO_MODE === "true"
  ) {
    return new DemoMembershipPort(environment, clock);
  }
  return new FailClosedMembershipPort();
}

export function parseDemoActor(
  environment: Record<string, string | undefined>
): ActorContext {
  if (environment.NODE_ENV === "production") {
    throw new Error("Demo identity is forbidden in production");
  }
  if (environment.DEMO_MODE !== "true") {
    throw new Error("Demo mode is disabled");
  }

  const identity = demoIdentitySchema.parse({
    DEMO_TENANT_ID: environment.DEMO_TENANT_ID,
    DEMO_ACTOR_ID: environment.DEMO_ACTOR_ID,
    DEMO_ACTOR_ROLE: environment.DEMO_ACTOR_ROLE
  });
  return Object.freeze({
    tenantId: identity.DEMO_TENANT_ID,
    actorId: identity.DEMO_ACTOR_ID,
    role: identity.DEMO_ACTOR_ROLE
  });
}
