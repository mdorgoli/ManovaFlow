import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiError } from "./api-response";
import { AuthorizationError } from "@/modules/growth/domain/rbac";
import { AuthenticationError } from "@/modules/identity/application/auth-port";
import {
  APPROVAL_FORBIDDEN,
  APPROVAL_IDEMPOTENCY_CONFLICT,
  COMPLETION_EVIDENCE_REQUIRED,
  INVALID_TRANSITION,
  LIFECYCLE_FORBIDDEN,
  LIFECYCLE_IDEMPOTENCY_CONFLICT,
  SAFETY_BLOCK_CANNOT_RESUME,
  SERVICE_REQUEST_NOT_FOUND,
  STALE_OR_UNSAFE_PROPOSAL,
  STALE_REQUEST_REVISION
} from "@/modules/serviceflow/application/repository";

const serviceFlowConflictMessages = new Set([
  INVALID_TRANSITION,
  STALE_OR_UNSAFE_PROPOSAL,
  STALE_REQUEST_REVISION,
  SAFETY_BLOCK_CANNOT_RESUME,
  COMPLETION_EVIDENCE_REQUIRED
]);

const idempotencyConflictMessages = new Set([
  APPROVAL_IDEMPOTENCY_CONFLICT,
  LIFECYCLE_IDEMPOTENCY_CONFLICT
]);

export function assertLocalServiceFlowDemoApi(): void {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEMO_MODE !== "true"
  ) {
    throw new ServiceFlowApiError(
      503,
      "DEMO_UNAVAILABLE",
      "ServiceFlow demo API is unavailable"
    );
  }
}

export function serviceFlowApiError(error: unknown): NextResponse {
  if (error instanceof ServiceFlowApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.publicMessage } },
      { status: error.status }
    );
  }
  if (
    error instanceof ZodError ||
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError
  ) {
    return apiError(error);
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed"
        }
      },
      { status: 400 }
    );
  }
  const message = error instanceof Error ? error.message : "";
  if (message === SERVICE_REQUEST_NOT_FOUND) {
    return NextResponse.json(
      {
        error: {
          code: "SERVICEFLOW_NOT_FOUND",
          message: "ServiceFlow resource was not found"
        }
      },
      { status: 404 }
    );
  }
  if (message === APPROVAL_FORBIDDEN || message === LIFECYCLE_FORBIDDEN) {
    return NextResponse.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "ServiceFlow mutation is forbidden"
        }
      },
      { status: 403 }
    );
  }
  if (idempotencyConflictMessages.has(message)) {
    return NextResponse.json(
      {
        error: { code: "IDEMPOTENCY_CONFLICT", message: "Idempotency conflict" }
      },
      { status: 409 }
    );
  }
  if (serviceFlowConflictMessages.has(message)) {
    return NextResponse.json(
      {
        error: {
          code: "SERVICEFLOW_CONFLICT",
          message: "ServiceFlow command was rejected"
        }
      },
      { status: 409 }
    );
  }
  if (message.startsWith("A valid Idempotency-Key")) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed"
        }
      },
      { status: 400 }
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "SERVICEFLOW_UNAVAILABLE",
        message: "ServiceFlow demo API is unavailable"
      }
    },
    { status: 500 }
  );
}

class ServiceFlowApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string
  ) {
    super(publicMessage);
    this.name = "ServiceFlowApiError";
  }
}
