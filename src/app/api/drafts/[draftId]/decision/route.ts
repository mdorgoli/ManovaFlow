import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { authorizeDraftDecision } from "@/lib/api-policy";
import { getGrowthRepository } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";

const decisionSchema = z.strictObject({
  decision: z.enum(["APPROVED_INTERNAL", "REJECTED"])
});

export async function POST(
  request: Request,
  context: { params: Promise<{ draftId: string }> }
): Promise<NextResponse> {
  try {
    const actor = await resolveRequestActor(request);
    authorizeDraftDecision(actor, request.headers);
    const { draftId } = await context.params;
    const id = z.uuid().parse(draftId);
    const payload = decisionSchema.parse(await request.json());
    const draft = await getGrowthRepository().decideDraft(
      actor,
      id,
      payload.decision
    );
    await getGrowthRepository().appendAudit(actor, {
      eventType: "DRAFT_DECIDED_INTERNAL_ONLY",
      laneKey: draft.laneKey,
      entityId: draft.id,
      details: { decision: draft.decision, outboundEnabled: false }
    });
    return NextResponse.json({ draft, outboundEnabled: false });
  } catch (error) {
    return apiError(error);
  }
}
