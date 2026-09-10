import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import {
  getDatabaseClient,
  getIdentityDatabaseClient
} from "@/lib/container";
import { AuthenticationError } from "@/modules/identity/application/auth-port";
import { createProductionIdentityServices } from "@/modules/identity/infrastructure/production-identity";
import { serializeIssuedSessionCookies } from "@/modules/identity/infrastructure/session-cookie";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const now = new Date();
    const services = createProductionIdentityServices(
      getIdentityDatabaseClient(),
      getDatabaseClient(),
      process.env,
      () => now
    );
    await services.rateLimiter.consume({
      operation: "SESSION_ROTATE",
      request,
      now
    });
    const issued = await services.sessionService.rotateRequest(request);
    const response = new NextResponse(null, { status: 204 });
    for (const cookie of serializeIssuedSessionCookies(issued, now)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    return apiError(
      error instanceof AuthenticationError
        ? error
        : new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE")
    );
  }
}
