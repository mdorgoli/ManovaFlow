import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/modules/growth/domain/rbac";
import { DashboardReadModelError } from "@/modules/growth/application/dashboard-read-model";
import { AuthenticationError } from "@/modules/identity/application/auth-port";

export function apiError(error: unknown): NextResponse {
  if (error instanceof DashboardReadModelError) {
    return NextResponse.json(
      {
        error: {
          code: "DASHBOARD_UNAVAILABLE",
          message: "Dashboard read model is unavailable"
        }
      },
      { status: 503 }
    );
  }
  if (error instanceof AuthenticationError) {
    const responseInit: ResponseInit = { status: error.status };
    if (error.retryAfterSeconds !== undefined) {
      responseInit.headers = {
        "retry-after": String(error.retryAfterSeconds)
      };
    }
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      responseInit
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: 403 }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        }
      },
      { status: 400 }
    );
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = /Demo mode|Demo identity/.test(message) ? 503 : 400;
  return NextResponse.json(
    { error: { code: status === 503 ? "DEMO_UNAVAILABLE" : "REQUEST_REJECTED", message } },
    { status }
  );
}
