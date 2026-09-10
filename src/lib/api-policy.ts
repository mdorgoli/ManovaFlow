import type { ActorContext } from "@/modules/growth/domain/types";
import { requireCapability } from "@/modules/growth/domain/rbac";
import { rejectClientIdentityHeaders } from "@/modules/identity/application/auth-port";

export function authorizeDashboard(
  actor: ActorContext,
  headers: Headers
): void {
  rejectClientIdentity(headers);
  requireCapability(actor, "VIEW_DASHBOARD");
}

export function authorizeResearchRun(
  actor: ActorContext,
  headers: Headers
): string {
  rejectClientIdentity(headers);
  requireCapability(actor, "RUN_RESEARCH");
  const key = headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(key)) {
    throw new Error(
      "A valid Idempotency-Key header (1-200 safe characters) is required"
    );
  }
  return key;
}

export function authorizeDraftDecision(
  actor: ActorContext,
  headers: Headers
): { outboundEnabled: false } {
  rejectClientIdentity(headers);
  requireCapability(actor, "DECIDE_DRAFT");
  return { outboundEnabled: false };
}

export function authorizeSuppression(
  actor: ActorContext,
  headers: Headers
): void {
  rejectClientIdentity(headers);
  requireCapability(actor, "MANAGE_SUPPRESSION");
}

export function authorizeServiceFlowRead(
  actor: ActorContext,
  headers: Headers
): void {
  rejectClientIdentity(headers);
  requireCapability(actor, "VIEW_SERVICEFLOW");
}

export function authorizeServiceFlowMutation(
  actor: ActorContext,
  headers: Headers
): string {
  rejectClientIdentity(headers);
  requireCapability(actor, "MUTATE_SERVICEFLOW");
  const key = headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    throw new Error(
      "A valid Idempotency-Key header (8-128 safe characters) is required"
    );
  }
  return key;
}

function rejectClientIdentity(headers: Headers): void {
  rejectClientIdentityHeaders(headers);
}
