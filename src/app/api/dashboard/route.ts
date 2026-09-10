import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { authorizeDashboard } from "@/lib/api-policy";
import { getGrowthRepository, getStorageMode } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import {
  buildDashboardReadModel,
  dashboardDatasetFor,
  DashboardReadModelError
} from "@/modules/growth/application/dashboard-read-model";

export const dynamic = "force-dynamic";

const auditPageSchema = z.strictObject({
  beforeSequence: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const actor = await resolveRequestActor(request);
    authorizeDashboard(actor, request.headers);
    const snapshot = await getGrowthRepository().getDashboard(actor);
    if (
      process.env.DEMO_MODE !== "true" ||
      process.env.NODE_ENV === "production"
    ) {
      throw new DashboardReadModelError(
        "DASHBOARD_RUNTIME_INVARIANT_VIOLATION"
      );
    }
    const auditPage = parseAuditPage(request);
    const readModel = buildDashboardReadModel({
      actor,
      snapshot,
      generatedAt: new Date().toISOString(),
      runtime: {
        mode: "DEMO",
        dataset: dashboardDatasetFor(snapshot),
        storageMode: getStorageMode(),
        outboundGateway: "DISABLED",
        outboundCredentials: "ABSENT"
      },
      ...(auditPage ? { auditPage } : {})
    });
    return NextResponse.json(readModel, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return apiError(error);
  }
}

function parseAuditPage(
  request: Request
): { beforeSequence?: number; limit?: number } | undefined {
  const search = new URL(request.url).searchParams;
  if (
    search.getAll("auditBefore").length > 1 ||
    search.getAll("auditLimit").length > 1
  ) {
    throw new Error("Dashboard audit pagination is invalid");
  }
  const auditBefore = search.get("auditBefore");
  const auditLimit = search.get("auditLimit");
  if (auditBefore === null && auditLimit === null) return undefined;
  const parsed = auditPageSchema.parse({
    ...(auditBefore === null ? {} : { beforeSequence: auditBefore }),
    ...(auditLimit === null ? {} : { limit: auditLimit })
  });
  return {
    ...(parsed.beforeSequence === undefined
      ? {}
      : { beforeSequence: parsed.beforeSequence }),
    ...(parsed.limit === undefined ? {} : { limit: parsed.limit })
  };
}
