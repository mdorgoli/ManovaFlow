import { NextResponse } from "next/server";
import { authorizeServiceFlowRead } from "@/lib/api-policy";
import { getServiceFlowService } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import {
  assertLocalServiceFlowDemoApi,
  serviceFlowApiError
} from "@/lib/serviceflow-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    assertLocalServiceFlowDemoApi();
    const actor = await resolveRequestActor(request);
    authorizeServiceFlowRead(actor, request.headers);
    const snapshot = await getServiceFlowService().getSnapshot(actor);
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return serviceFlowApiError(error);
  }
}
