import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryServiceFlowRepository,
  ServiceFlowService,
  type CompletionEvidence,
  type ServiceRequest,
  type ServiceFlowSnapshot
} from "@/modules/serviceflow";
import type { ActorContext } from "@/modules/growth/domain/types";

const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "10000000-0000-4000-8000-000000000002";
const ownerA: ActorContext = {
  tenantId: tenantA,
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
};
const ownerB: ActorContext = {
  tenantId: tenantB,
  actorId: "20000000-0000-4000-8000-000000000002",
  role: "OWNER"
};

const state = vi.hoisted(() => ({
  actor: null as unknown as ActorContext,
  service: null as unknown as ServiceFlowService
}));

vi.mock("@/lib/container", () => ({
  getServiceFlowService: () => state.service
}));

vi.mock("@/lib/request-auth", () => ({
  resolveRequestActor: async () => structuredClone(state.actor)
}));

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("NODE_ENV", "test");
  state.actor = structuredClone(ownerA);
  let serial = 0;
  let tick = 0;
  state.service = new ServiceFlowService(
    new InMemoryServiceFlowRepository({
      id: () => `serviceflow-api-${++serial}`,
      now: () => new Date(1_780_300_000_000 + tick++)
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local ServiceFlow API", () => {
  it("fails closed when the local demo runtime is disabled", async () => {
    const routes = await loadRoutes();
    vi.stubEnv("DEMO_MODE", "false");

    const response = await routes.root.GET(
      new Request("https://app.example.test/api/serviceflow")
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "DEMO_UNAVAILABLE",
        message: "ServiceFlow demo API is unavailable"
      }
    });
  });

  it("returns a private tenant snapshot and derives identity only from server context", async () => {
    const routes = await loadRoutes();
    await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-api-snapshot")
    );

    const response = await routes.root.GET(
      new Request("https://app.example.test/api/serviceflow")
    );
    const snapshot = (await response.json()) as ServiceFlowSnapshot;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(snapshot.cases).toHaveLength(2);
    expect(
      snapshot.cases.every((item) => item.request.tenantId === tenantA)
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(tenantB);
  });

  it("runs the approved request through approve, start, evidence, complete, and close", async () => {
    const routes = await loadRoutes();
    const resetResponse = await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-api-chain")
    );
    const reset = (await resetResponse.json()) as ServiceFlowSnapshot;
    const normal = reset.cases[0]!;
    const proposal = normal.evaluation.proposal!;

    const approved = await command(
      routes,
      normal.request.id,
      "approve-api-chain",
      {
        action: "APPROVE",
        requestRevision: normal.request.revision,
        technicianId: proposal.technicianId,
        proposalPolicyVersion: proposal.policyVersion,
        proposalRuleVersion: proposal.ruleVersion,
        reason: "DEMO: owner approves the API assignment."
      }
    );
    const started = await command(
      routes,
      normal.request.id,
      "start-api-chain",
      {
        action: "START",
        requestRevision: approved.request.revision,
        reason: "DEMO: owner starts API work."
      }
    );
    const withEvidence = await command(
      routes,
      normal.request.id,
      "evidence-api-chain",
      {
        action: "ATTACH_EVIDENCE",
        requestRevision: started.request.revision,
        evidenceType: "DEMO_INTERNAL_FIXTURE",
        evidenceAssetId: "DEMO_EVIDENCE_FIXTURE_COMPLETION_01"
      }
    );
    const completed = await command(
      routes,
      normal.request.id,
      "complete-api-chain",
      {
        action: "COMPLETE",
        requestRevision: withEvidence.request.revision,
        reason: "DEMO: owner verifies API completion evidence."
      }
    );
    const closed = await command(routes, normal.request.id, "close-api-chain", {
      action: "CLOSE",
      requestRevision: completed.request.revision,
      reason: "DEMO: owner closes the API request."
    });

    expect(approved.request.state).toBe("ASSIGNED");
    expect(started.request.state).toBe("IN_PROGRESS");
    expect(withEvidence.evidence).toMatchObject({
      type: "DEMO_INTERNAL_FIXTURE",
      attachedBy: ownerA.actorId
    });
    expect(completed.request.state).toBe("COMPLETED");
    expect(closed.request.state).toBe("CLOSED");
    expect(closed.outboundActionCount).toBe(0);
  });

  it("creates only strict synthetic requests and rejects body-controlled identity", async () => {
    const routes = await loadRoutes();
    const valid = await routes.requests.POST(
      jsonRequest(
        "/api/serviceflow/requests",
        {
          synthetic: true,
          description: "DEMO: a bounded non-emergency plumbing request.",
          address: "DEMO_CENTRAL_ZONE",
          service: "PLUMBING_LEAK",
          requestedHour: 10,
          safetyAssessment: "SAFE"
        },
        "create-api-valid"
      )
    );
    expect(valid.status).toBe(201);

    const invalid = await routes.requests.POST(
      jsonRequest(
        "/api/serviceflow/requests",
        {
          synthetic: true,
          description: "DEMO: identity injection must be rejected.",
          address: "DEMO_CENTRAL_ZONE",
          service: "PLUMBING_LEAK",
          requestedHour: 10,
          safetyAssessment: "SAFE",
          tenantId: tenantB,
          role: "OWNER"
        },
        "create-api-invalid"
      )
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed" }
    });
    expect((await state.service.getSnapshot(ownerA)).cases).toHaveLength(1);
  });

  it("rejects Viewer mutation and client-controlled identity headers without mutation", async () => {
    const routes = await loadRoutes();
    await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-auth-baseline")
    );
    const baseline = await state.service.getSnapshot(ownerA);

    state.actor = { ...ownerA, role: "VIEWER" };
    const viewerResponse = await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-viewer-api")
    );
    expect(viewerResponse.status).toBe(403);
    await expect(viewerResponse.json()).resolves.toMatchObject({
      error: { code: "FORBIDDEN" }
    });

    state.actor = structuredClone(ownerA);
    const spoofed = await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-spoofed-api", {
        "x-tenant-id": tenantB
      })
    );
    expect(spoofed.status).toBe(400);
    await expect(spoofed.json()).resolves.toMatchObject({
      error: { code: "IDENTITY_SPOOFING_DETECTED" }
    });
    expect(await state.service.getSnapshot(ownerA)).toEqual(baseline);
  });

  it("keeps tenant snapshots isolated and returns a non-disclosing cross-tenant not-found", async () => {
    const routes = await loadRoutes();
    const tenantAReset = await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-tenant-a-api")
    );
    const tenantASnapshot = (await tenantAReset.json()) as ServiceFlowSnapshot;
    const tenantARequestId = tenantASnapshot.cases[0]!.request.id;

    state.actor = structuredClone(ownerB);
    await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-tenant-b-api")
    );
    const tenantBRead = await routes.root.GET(
      new Request("https://app.example.test/api/serviceflow")
    );
    const tenantBSnapshot = (await tenantBRead.json()) as ServiceFlowSnapshot;
    expect(
      tenantBSnapshot.cases.every((item) => item.request.tenantId === tenantB)
    ).toBe(true);
    expect(JSON.stringify(tenantBSnapshot)).not.toContain(tenantARequestId);

    const crossTenant = await routes.commands.POST(
      jsonRequest(
        `/api/serviceflow/requests/${tenantARequestId}/commands`,
        {
          action: "START",
          requestRevision: 1,
          reason: "DEMO: cross-tenant command must not disclose state."
        },
        "start-cross-tenant-api"
      ),
      { params: Promise.resolve({ requestId: tenantARequestId }) }
    );
    expect(crossTenant.status).toBe(404);
    await expect(crossTenant.json()).resolves.toEqual({
      error: {
        code: "SERVICEFLOW_NOT_FOUND",
        message: "ServiceFlow resource was not found"
      }
    });
    expect(await state.service.getSnapshot(ownerA)).toEqual(tenantASnapshot);
  });

  it("repeats reset with the same key after mutation and recreates the identical baseline", async () => {
    const routes = await loadRoutes();
    const firstResponse = await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-repeat-api")
    );
    const first = (await firstResponse.json()) as ServiceFlowSnapshot;
    const createResponse = await routes.requests.POST(
      jsonRequest(
        "/api/serviceflow/requests",
        {
          synthetic: true,
          description: "DEMO: temporary request removed by reset.",
          address: "DEMO_NORTH_ZONE",
          service: "PLUMBING_LEAK",
          requestedHour: 11,
          safetyAssessment: "SAFE"
        },
        "create-before-repeat-reset"
      )
    );
    expect(createResponse.status).toBe(201);

    const secondResponse = await routes.reset.POST(
      jsonRequest("/api/serviceflow/reset", {}, "reset-repeat-api")
    );
    const second = (await secondResponse.json()) as ServiceFlowSnapshot;
    expect(second).toEqual(first);
  });
});

async function loadRoutes() {
  const [root, reset, requests, commands] = await Promise.all([
    import("@/app/api/serviceflow/route"),
    import("@/app/api/serviceflow/reset/route"),
    import("@/app/api/serviceflow/requests/route"),
    import("@/app/api/serviceflow/requests/[requestId]/commands/route")
  ]);
  return { root, reset, requests, commands };
}

async function command(
  routes: Awaited<ReturnType<typeof loadRoutes>>,
  requestId: string,
  key: string,
  body: Record<string, unknown>
): Promise<ApiCommandResponse> {
  const response = await routes.commands.POST(
    jsonRequest(`/api/serviceflow/requests/${requestId}/commands`, body, key),
    { params: Promise.resolve({ requestId }) }
  );
  expect(response.status).toBe(200);
  return response.json() as Promise<ApiCommandResponse>;
}

type ApiCommandResponse = {
  request: ServiceRequest;
  evidence?: CompletionEvidence;
  outboundActionCount: 0;
};

function jsonRequest(
  path: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
  headers: HeadersInit = {}
): Request {
  return new Request(`https://app.example.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      ...Object.fromEntries(new Headers(headers))
    },
    body: JSON.stringify(body)
  });
}
