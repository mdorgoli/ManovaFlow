import type { Sql } from "postgres";
import type { ActorContext } from "@/modules/growth/domain/types";
import {
  getDatabaseClient,
  getIdentityDatabaseClient
} from "@/lib/container";
import { authenticateRequest } from "@/modules/identity/application/auth-port";
import {
  createDefaultAuthPort,
  createDefaultMembershipPort
} from "@/modules/identity/infrastructure/default-auth-port";
import { PostgresMembershipPort } from "@/modules/identity/infrastructure/postgres-membership-port";
import { createProductionIdentityServices } from "@/modules/identity/infrastructure/production-identity";

export async function resolveRequestActor(
  request: Request,
  environment: Record<string, string | undefined> = process.env,
  now: Date = new Date(),
  applicationDatabaseClient?: Sql,
  identityDatabaseClient?: Sql
): Promise<ActorContext> {
  const production = environment.NODE_ENV === "production";
  let authPort = createDefaultAuthPort(environment, () => now);
  let membershipPort = createDefaultMembershipPort(environment, () => now);
  if (production && environment.DATABASE_URL) {
    try {
      const services = createProductionIdentityServices(
        identityDatabaseClient ?? getIdentityDatabaseClient(),
        applicationDatabaseClient ?? getDatabaseClient(),
        environment,
        () => now
      );
      authPort = services.authPort;
      membershipPort = services.membershipPort;
    } catch {
      authPort = createDefaultAuthPort(environment, () => now);
      membershipPort = createDefaultMembershipPort(environment, () => now);
    }
  } else if (!production && environment.DATABASE_URL) {
    membershipPort = new PostgresMembershipPort(
      applicationDatabaseClient ?? getDatabaseClient(),
      () => now,
      environment
    );
  }
  return authenticateRequest({
    request,
    authPort,
    membershipPort,
    policy: {
      environment: production ? "production" : "non-production",
      now,
      requireMfa: production
    }
  });
}
