import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeServiceFlowMutation } from "@/lib/api-policy";
import { getServiceFlowService } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import {
  assertLocalServiceFlowDemoApi,
  serviceFlowApiError
} from "@/lib/serviceflow-api";
import {
  approveProposalCommandSchema,
  attachCompletionEvidenceCommandSchema,
  generatedRequestIdSchema,
  lifecycleCommandSchema
} from "@/modules/serviceflow/domain/schema";

const approvalBodySchema = approveProposalCommandSchema
  .omit({ requestId: true })
  .extend({ action: z.literal("APPROVE") });
const lifecycleBodySchema = (
  action: "START" | "BLOCK" | "RESUME" | "COMPLETE" | "CLOSE"
) =>
  lifecycleCommandSchema
    .omit({ requestId: true })
    .extend({ action: z.literal(action) });
const evidenceBodySchema = attachCompletionEvidenceCommandSchema
  .omit({ requestId: true })
  .extend({ action: z.literal("ATTACH_EVIDENCE") });

const commandBodySchema = z.discriminatedUnion("action", [
  approvalBodySchema,
  lifecycleBodySchema("START"),
  lifecycleBodySchema("BLOCK"),
  lifecycleBodySchema("RESUME"),
  evidenceBodySchema,
  lifecycleBodySchema("COMPLETE"),
  lifecycleBodySchema("CLOSE")
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> }
): Promise<NextResponse> {
  try {
    assertLocalServiceFlowDemoApi();
    const actor = await resolveRequestActor(request);
    const idempotencyKey = authorizeServiceFlowMutation(actor, request.headers);
    const { requestId: rawRequestId } = await context.params;
    const requestId = generatedRequestIdSchema.parse(rawRequestId);
    const command = commandBodySchema.parse(await request.json());
    const service = getServiceFlowService();

    const result = await dispatchCommand(
      service,
      actor,
      requestId,
      command,
      idempotencyKey
    );
    return NextResponse.json(result, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return serviceFlowApiError(error);
  }
}

async function dispatchCommand(
  service: ReturnType<typeof getServiceFlowService>,
  actor: Awaited<ReturnType<typeof resolveRequestActor>>,
  requestId: string,
  command: z.infer<typeof commandBodySchema>,
  idempotencyKey: string
) {
  switch (command.action) {
    case "APPROVE":
      return service.approveProposal(
        actor,
        {
          requestId,
          requestRevision: command.requestRevision,
          technicianId: command.technicianId,
          proposalPolicyVersion: command.proposalPolicyVersion,
          proposalRuleVersion: command.proposalRuleVersion,
          reason: command.reason
        },
        idempotencyKey
      );
    case "START":
      return service.startRequest(
        actor,
        lifecycleCommand(requestId, command),
        idempotencyKey
      );
    case "BLOCK":
      return service.blockRequest(
        actor,
        lifecycleCommand(requestId, command),
        idempotencyKey
      );
    case "RESUME":
      return service.resumeRequest(
        actor,
        lifecycleCommand(requestId, command),
        idempotencyKey
      );
    case "ATTACH_EVIDENCE":
      return service.attachCompletionEvidence(
        actor,
        {
          requestId,
          requestRevision: command.requestRevision,
          evidenceType: command.evidenceType,
          evidenceAssetId: command.evidenceAssetId
        },
        idempotencyKey
      );
    case "COMPLETE":
      return service.completeRequest(
        actor,
        lifecycleCommand(requestId, command),
        idempotencyKey
      );
    case "CLOSE":
      return service.closeRequest(
        actor,
        lifecycleCommand(requestId, command),
        idempotencyKey
      );
  }
}

function lifecycleCommand(
  requestId: string,
  command: { requestRevision: number; reason: string }
) {
  return {
    requestId,
    requestRevision: command.requestRevision,
    reason: command.reason
  };
}
