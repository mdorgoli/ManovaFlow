import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeServiceFlowMutation } from "@/lib/api-policy";
import { getServiceFlowService } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import {
  assertLocalServiceFlowDemoApi,
  serviceFlowApiError
} from "@/lib/serviceflow-api";

const resetBodySchema = z.strictObject({});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertLocalServiceFlowDemoApi();
    const actor = await resolveRequestActor(request);
    const idempotencyKey = authorizeServiceFlowMutation(actor, request.headers);
    resetBodySchema.parse(await request.json());
    const snapshot = await getServiceFlowService().resetDemoTenant(
      actor,
      idempotencyKey
    );
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return serviceFlowApiError(error);
  }
}
