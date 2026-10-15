import { describe, expect, it } from "vitest";
import {
  InMemoryServiceFlowRepository,
  ServiceFlowService,
  type ApprovalActor,
  type ServiceRequestInput
} from "@/modules/serviceflow";

const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "10000000-0000-4000-8000-000000000002";
const ownerA: ApprovalActor = {
  tenantId: tenantA,
  actorId: "20000000-0000-4000-8000-000000000001",
  role: "OWNER"
};
const viewerA: ApprovalActor = {
  tenantId: tenantA,
  actorId: "20000000-0000-4000-8000-000000000002",
  role: "VIEWER"
};
const ownerB: ApprovalActor = {
  tenantId: tenantB,
  actorId: "20000000-0000-4000-8000-000000000003",
  role: "OWNER"
};

const safeInput: ServiceRequestInput = {
  synthetic: true,
  description: "DEMO: kitchen sink has a slow leak and no safety concerns.",
  address: "DEMO_CENTRAL_ZONE",
  service: "PLUMBING_LEAK",
  requestedHour: 10,
  safetyAssessment: "SAFE"
};

describe("ServiceFlow deterministic demo reset", () => {
  it("rebuilds exactly two deterministic synthetic cases and returns the same snapshot twice", async () => {
    const service = createService();

    const first = await service.resetDemoTenant(ownerA, "reset-demo-first");
    expect(first.outboundActionCount).toBe(0);
    expect(first.cases).toHaveLength(2);
    expect(first.cases.map(({ request }) => request.id)).toEqual([
      "DEMO_10000000-0000-4000-8000-000000000001_REQUEST_STANDARD_001",
      "DEMO_10000000-0000-4000-8000-000000000001_REQUEST_SAFETY_001"
    ]);
    expect(first.cases.map(({ request }) => request.state)).toEqual([
      "REVIEW",
      "BLOCKED"
    ]);
    expect(first.cases[0]?.evaluation.proposal).not.toBeNull();
    expect(first.cases[1]?.evaluation).toMatchObject({
      blockReason: "POSSIBLE_EMERGENCY",
      proposal: null
    });
    expect(first.approvals).toEqual([]);
    expect(first.assignments).toEqual([]);
    expect(first.completionEvidence).toEqual([]);
    expect(first.audit[0]).toMatchObject({
      sequence: 1,
      type: "DEMO_TENANT_RESET",
      actorId: ownerA.actorId,
      createdAt: "2026-09-05T00:00:00.000Z"
    });

    const normal = first.cases[0]!;
    const proposal = normal.evaluation.proposal!;
    const approved = await service.approveProposal(
      ownerA,
      {
        requestId: normal.request.id,
        requestRevision: normal.request.revision,
        technicianId: proposal.technicianId,
        proposalPolicyVersion: proposal.policyVersion,
        proposalRuleVersion: proposal.ruleVersion,
        reason: "DEMO: mutate before proving reset replacement."
      },
      "approve-before-reset"
    );
    await service.startRequest(
      ownerA,
      {
        requestId: approved.request.id,
        requestRevision: approved.request.revision,
        reason: "DEMO: start before deterministic reset."
      },
      "start-before-reset"
    );

    const second = await service.resetDemoTenant(ownerA, "reset-demo-second");
    expect(second).toEqual(first);
    expect(await service.getSnapshot(ownerA)).toEqual(first);
  });

  it("resets only the authenticated demo tenant and leaves another tenant byte-for-byte unchanged", async () => {
    const service = createService();
    await service.resetDemoTenant(ownerA, "reset-tenant-a-initial");
    await service.createAndEvaluate(
      ownerB,
      safeInput,
      "create-tenant-b-control"
    );
    const tenantBBefore = await service.getSnapshot(ownerB);

    await service.resetDemoTenant(ownerA, "reset-tenant-a-repeat");

    expect(await service.getSnapshot(ownerB)).toEqual(tenantBBefore);
    expect(
      (await service.getSnapshot(ownerA)).cases.every(
        (item) => item.request.tenantId === tenantA
      )
    ).toBe(true);
    expect(
      tenantBBefore.cases.every((item) => item.request.tenantId === tenantB)
    ).toBe(true);
  });

  it("forbids Viewer reset without deleting or rewriting the tenant snapshot", async () => {
    const service = createService();
    const baseline = await service.resetDemoTenant(
      ownerA,
      "reset-viewer-baseline"
    );

    await expect(
      service.resetDemoTenant(viewerA, "reset-viewer-denied")
    ).rejects.toThrow("ServiceFlow lifecycle mutation is forbidden");

    expect(await service.getSnapshot(ownerA)).toEqual(baseline);
  });
});

function createService(): ServiceFlowService {
  let serial = 0;
  let tick = 0;
  return new ServiceFlowService(
    new InMemoryServiceFlowRepository({
      id: () => `serviceflow-reset-${++serial}`,
      now: () => new Date(1_780_200_000_000 + tick++)
    })
  );
}
