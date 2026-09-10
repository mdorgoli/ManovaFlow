import type { ActorContext } from "@/modules/growth/domain/types";
import { parseDemoActor } from "@/modules/identity/infrastructure/default-auth-port";

export function getDemoContext(
  environment: Record<string, string | undefined> = process.env
): ActorContext {
  return parseDemoActor(environment);
}
