import type { ActorContext, Role } from "./types";

export const CAPABILITIES = [
  "VIEW_DASHBOARD",
  "RUN_RESEARCH",
  "MANAGE_SUPPRESSION",
  "DECIDE_DRAFT",
  "VIEW_SERVICEFLOW",
  "MUTATE_SERVICEFLOW"
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const grants: Readonly<Record<Role, ReadonlySet<Capability>>> = {
  OWNER: new Set(capabilitiesForOwner()),
  OPERATOR: new Set([
    "VIEW_DASHBOARD",
    "RUN_RESEARCH",
    "MANAGE_SUPPRESSION",
    "VIEW_SERVICEFLOW",
    "MUTATE_SERVICEFLOW"
  ]),
  VIEWER: new Set(["VIEW_DASHBOARD", "VIEW_SERVICEFLOW"])
};

function capabilitiesForOwner(): readonly Capability[] {
  return [...CAPABILITIES];
}

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";

  constructor(role: Role, capability: Capability) {
    super("Role " + role + " cannot perform " + capability);
    this.name = "AuthorizationError";
  }
}

export function requireCapability(
  actor: ActorContext,
  capability: Capability
): void {
  if (!grants[actor.role].has(capability)) {
    throw new AuthorizationError(actor.role, capability);
  }
}
