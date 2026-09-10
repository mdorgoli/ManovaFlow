import { NextResponse } from "next/server";
import { authorizeServiceFlowMutation } from "@/lib/api-policy";
import { getServiceFlowService } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import {
  assertLocalServiceFlowDemoApi,
  serviceFlowApiError
} from "@/lib/serviceflow-api";
import { serviceRequestInputSchema } from "@/modules/serviceflow/domain/schema";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertLocalServiceFlowDemoApi();
    const actor = await resolveRequestActor(request);
    const idempotencyKey = authorizeServiceFlowMutation(actor, request.headers);
    const input = serviceRequestInputSchema.parse(await request.json());
    const result = await getServiceFlowService().createAndEvaluate(
      actor,
      input,
      idempotencyKey
    );
    return NextResponse.json(result, {
      status: 201,
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return serviceFlowApiError(error);
  }
}
