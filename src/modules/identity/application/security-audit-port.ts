import { z } from "zod";

export const SECURITY_AUDIT_EVENT_TYPES = [
  "OIDC_SESSION_ISSUED",
  "OIDC_TOKEN_REPLAY_BLOCKED",
  "SESSION_ROTATED",
  "SESSION_REVOKED",
  "SESSION_REPLAY_BLOCKED",
  "SESSION_EXPIRED",
  "SESSION_IDLE_TIMEOUT",
  "SESSION_MFA_EXPIRED",
  "SESSION_CSRF_BLOCKED",
  "AUTH_RATE_LIMIT_BLOCKED",
  "SESSION_PURGED"
] as const;

export const SECURITY_AUDIT_OUTCOMES = [
  "SUCCEEDED",
  "BLOCKED",
  "EXPIRED",
  "PURGED"
] as const;

const digest = z.string().regex(/^[0-9a-f]{64}$/);
const detailValue = z.union([
  z.string().max(256),
  z.number().finite(),
  z.boolean(),
  z.null()
]);
const forbiddenDetailKey =
  /(token|cookie|secret|authorization|password|csrf)/i;
const detailsSchema = z
  .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/), detailValue)
  .superRefine((details, context) => {
    if (Object.keys(details).length > 16) {
      context.addIssue({ code: "custom", message: "Too many audit details" });
    }
    for (const key of Object.keys(details)) {
      if (forbiddenDetailKey.test(key)) {
        context.addIssue({
          code: "custom",
          message: `Forbidden security audit detail key: ${key}`
        });
      }
    }
  });

const securityAuditEventSchema = z.strictObject({
  eventType: z.enum(SECURITY_AUDIT_EVENT_TYPES),
  outcome: z.enum(SECURITY_AUDIT_OUTCOMES),
  occurredAt: z.date().refine((value) => Number.isFinite(value.getTime())),
  tenantId: z.uuid().optional(),
  actorId: z.uuid().optional(),
  sessionId: z.uuid().optional(),
  subjectHash: digest.optional(),
  requestHash: digest.optional(),
  details: detailsSchema.default({})
});

export type SecurityAuditEventInput = z.input<typeof securityAuditEventSchema>;
export type ValidatedSecurityAuditEvent = z.output<
  typeof securityAuditEventSchema
>;

export interface SecurityAuditPort {
  append(event: SecurityAuditEventInput): Promise<void>;
}

export function validateSecurityAuditEvent(
  event: SecurityAuditEventInput
): ValidatedSecurityAuditEvent {
  const parsed = securityAuditEventSchema.safeParse(event);
  if (!parsed.success) {
    throw new Error("Security audit event or details are invalid");
  }
  return parsed.data;
}
