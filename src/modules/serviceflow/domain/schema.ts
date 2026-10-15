import { z } from "zod";
import type {
  ApprovalActor,
  ApproveProposalCommand,
  AttachCompletionEvidenceCommand,
  LifecycleCommand,
  ServiceFlowActor,
  ServiceFlowMutationActor,
  ServiceRequestInput
} from "./types";
import { DEMO_EVIDENCE_ASSET_IDS } from "./types";

const CONTACT_DETAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d\s().-]{6,}\d)/i;

const optionalDescription = z
  .string()
  .trim()
  .max(1_000)
  .superRefine((value, context) => {
    if (!value) return;
    if (!value.startsWith("DEMO:")) {
      context.addIssue({
        code: "custom",
        message: "Synthetic descriptions must visibly begin with DEMO:"
      });
    }
    if (CONTACT_DETAIL_PATTERN.test(value)) {
      context.addIssue({
        code: "custom",
        message:
          "Personal contact details are forbidden in synthetic descriptions"
      });
    }
  })
  .transform((value) =>
    value.slice("DEMO:".length).trim() ? value : undefined
  )
  .optional();

const optionalCode = z
  .string()
  .trim()
  .toUpperCase()
  .max(64)
  .regex(/^[A-Z0-9_]*$/, "ServiceFlow codes must be uppercase identifiers")
  .transform((value) => value || undefined)
  .optional();

const optionalDemoAddressCode = optionalCode.superRefine((value, context) => {
  if (value && !value.startsWith("DEMO_")) {
    context.addIssue({
      code: "custom",
      message: "Synthetic address codes must begin with DEMO_"
    });
  }
});

export const serviceRequestInputSchema = z.strictObject({
  synthetic: z.literal(true),
  description: optionalDescription,
  address: optionalDemoAddressCode,
  service: optionalCode,
  requestedHour: z.int().min(0).max(23),
  safetyAssessment: z.enum(["SAFE", "UNKNOWN"])
});

const safeIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9._:-]+$/, "Identifiers must use safe bounded characters");

export const serviceFlowActorSchema = z.strictObject({
  tenantId: safeIdentifierSchema,
  actorId: safeIdentifierSchema,
  role: z.enum(["OWNER", "OPERATOR", "VIEWER"]).optional()
});

export const approvalActorSchema = z.strictObject({
  tenantId: safeIdentifierSchema,
  actorId: safeIdentifierSchema,
  role: z.enum(["OWNER", "OPERATOR", "VIEWER"])
});

export const serviceFlowMutationActorSchema = approvalActorSchema;

export const generatedRequestIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Generated request ids must use safe bounded characters"
  );

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid idempotency key");

const technicianIdSchema = z
  .string()
  .trim()
  .min(6)
  .max(80)
  .regex(/^DEMO_[A-Z0-9_]+$/, "Synthetic technician ids must be DEMO-prefixed");

const syntheticHumanReasonSchema = z
  .string()
  .trim()
  .min(8)
  .max(500)
  .refine(
    (value) => value.startsWith("DEMO:"),
    "Human reasons must visibly begin with DEMO:"
  )
  .refine(
    (value) => !CONTACT_DETAIL_PATTERN.test(value),
    "Personal contact details are forbidden in synthetic human reasons"
  );

export const approveProposalCommandSchema = z.strictObject({
  requestId: generatedRequestIdSchema,
  requestRevision: z.int().positive(),
  technicianId: technicianIdSchema,
  proposalPolicyVersion: safeIdentifierSchema,
  proposalRuleVersion: safeIdentifierSchema,
  reason: syntheticHumanReasonSchema
});

export const lifecycleCommandSchema = z.strictObject({
  requestId: generatedRequestIdSchema,
  requestRevision: z.int().positive(),
  reason: syntheticHumanReasonSchema
});

export const attachCompletionEvidenceCommandSchema = z.strictObject({
  requestId: generatedRequestIdSchema,
  requestRevision: z.int().positive(),
  evidenceType: z.literal("DEMO_INTERNAL_FIXTURE"),
  evidenceAssetId: z.enum(DEMO_EVIDENCE_ASSET_IDS)
});

const catalogCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9_]+$/, "Catalog values must be uppercase identifiers");

const uniqueCatalogValues = <T>(values: readonly T[]) =>
  new Set(values).size === values.length;

export const technicianSchema = z.strictObject({
  id: technicianIdSchema,
  label: z
    .string()
    .trim()
    .min(12)
    .max(160)
    .refine(
      (value) => value.includes("DEMO") && value.includes("SYNTHETIC"),
      "Synthetic technician labels must visibly include DEMO and SYNTHETIC"
    ),
  synthetic: z.literal(true),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  skills: z
    .array(catalogCodeSchema)
    .min(1)
    .max(20)
    .refine(uniqueCatalogValues, "Technician skills must be unique"),
  serviceAreas: z
    .array(
      catalogCodeSchema.refine(
        (value) => value.startsWith("DEMO_"),
        "Service areas must be DEMO-prefixed"
      )
    )
    .min(1)
    .max(20)
    .refine(uniqueCatalogValues, "Technician service areas must be unique"),
  availableHours: z
    .array(z.int().min(0).max(23))
    .min(1)
    .max(24)
    .refine(uniqueCatalogValues, "Technician available hours must be unique")
});

export const technicianCatalogSchema = z
  .array(technicianSchema)
  .min(1)
  .max(20)
  .refine(
    (catalog) =>
      uniqueCatalogValues(catalog.map((technician) => technician.id)),
    "Synthetic technician ids must be unique"
  );

export function parseServiceRequestInput(input: unknown): ServiceRequestInput {
  return serviceRequestInputSchema.parse(input);
}

export function parseServiceFlowActor(input: unknown): ServiceFlowActor {
  return serviceFlowActorSchema.parse(input);
}

export function parseApprovalActor(input: unknown): ApprovalActor {
  return approvalActorSchema.parse(input);
}

export function parseServiceFlowMutationActor(
  input: unknown
): ServiceFlowMutationActor {
  return serviceFlowMutationActorSchema.parse(input);
}

export function parseApproveProposalCommand(
  input: unknown
): ApproveProposalCommand {
  return approveProposalCommandSchema.parse(input);
}

export function parseLifecycleCommand(input: unknown): LifecycleCommand {
  return lifecycleCommandSchema.parse(input);
}

export function parseAttachCompletionEvidenceCommand(
  input: unknown
): AttachCompletionEvidenceCommand {
  return attachCompletionEvidenceCommandSchema.parse(input);
}

export function parseIdempotencyKey(input: unknown): string {
  return idempotencyKeySchema.parse(input);
}

export function parseTechnicianCatalog(input: unknown) {
  return technicianCatalogSchema.parse(input);
}
