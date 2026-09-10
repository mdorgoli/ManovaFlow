import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { authorizeSuppression } from "@/lib/api-policy";
import { getGrowthRepository } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";

const suppressionSchema = z.strictObject({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(253)
    .regex(/^(?!.*\.\.)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/),
  reason: z.string().trim().min(3).max(500)
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await resolveRequestActor(request);
    authorizeSuppression(actor, request.headers);
    const payload = suppressionSchema.parse(await request.json());
    const suppression = await getGrowthRepository().suppressDomain(
      actor,
      payload.domain,
      payload.reason
    );
    await getGrowthRepository().appendAudit(actor, {
      eventType: "TENANT_DOMAIN_SUPPRESSED",
      laneKey: null,
      entityId: suppression.id,
      details: {
        normalizedDomain: suppression.normalizedDomain,
        scope: "TENANT_WIDE"
      }
    });
    return NextResponse.json({ suppression }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
