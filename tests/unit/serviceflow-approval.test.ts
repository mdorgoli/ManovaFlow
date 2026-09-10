import { describe, expect, it } from "vitest";
import {
  InMemoryServiceFlowRepository,
  ServiceFlowService,
  type ApprovalActor,
  type ApproveProposalCommand,
  type ServiceRequest,
  type ServiceRequestInput
} from "@/modules/serviceflow";

const tenantA = "tenant-demo-a";
const tenantB = "tenant-demo-b";
const intakeActor = { tenantId: tenantA, actorId: "intake-demo-a" };
const owner: ApprovalActor = { tenantId: tenantA, actorId: "owner-demo-a", role: "OWNER" };
const operator: ApprovalActor = {
  tenantId: tenantA,
  actorId: "operator-demo-a",
  role: "OPERATOR"
};
const viewer: ApprovalActor = { tenantId: tenantA, actorId: "viewer-demo-a", role: "VIEWER" };
const otherTenantOwner: ApprovalActor = {
  tenantId: tenantB,
  actorId: "owner-demo-b",
  role: "OWNER"
};

const baseInput: ServiceRequestInput = {
  synthetic: true,
  description: "DEMO: kitchen sink has a slow leak and no safety concerns.",
  address: "DEMO_CENTRAL_ZONE",
  service: "PLUMBING_LEAK",
  requestedHour: 10,
  safetyAssessment: "SAFE"
};

describe("ServiceFlow human proposal approval", () => {
  it.each([
    [owner, "OWNER"],
    [operator, "OPERATOR"]
  ] as const)("lets a same-tenant %s approve a current safe proposal and assigns atomically", async (actor, role) => {
    const service = createService();
    const created = await createReview(service, `create-${role.toLowerCase()}`);
    const proposal = created.evaluation.proposal!;

    const result = await approvalApi(service).approveProposal(
      actor,
      commandFor(created.request, proposal, "DEMO: human verified scope and availability."),
      `approve-${role.toLowerCase()}-001`
    );

    expect(result.request).toMatchObject({
      state: "ASSIGNED",
      revision: 2,
      ownerId: actor.actorId,
      assigneeId: proposal.technicianId,
      assignmentId: result.assignment.id
    });
    expect(result.approval).toMatchObject({
      requestId: created.request.id,
      technicianId: proposal.technicianId,
      approvedBy: actor.actorId,
      approvedByRole: role,
      reason: "DEMO: human verified scope and availability."
    });
    expect(result.assignment).toMatchObject({
      requestId: created.request.id,
      technicianId: proposal.technicianId,
      approvalId: result.approval.id,
      assignedBy: actor.actorId
    });
    expect(result.outboundActionCount).toBe(0);

    const approvalEvents = (await service.listAudit(actor)).slice(-2);
    expect(approvalEvents).toEqual([
      expect.objectContaining({
        type: "PROPOSAL_APPROVED",
        actorId: actor.actorId,
        details: expect.objectContaining({
          fromState: "REVIEW",
          toState: "APPROVED",
          reason: "DEMO: human verified scope and availability."
        })
      }),
      expect.objectContaining({
        type: "ASSIGNMENT_CREATED",
        actorId: actor.actorId,
        details: expect.objectContaining({
          fromState: "APPROVED",
          toState: "ASSIGNED",
          technicianId: proposal.technicianId
        })
      })
    ]);
  });

  it("keeps proposal-only intake unassigned until an approval command succeeds", async () => {
    const service = createService();
    const created = await createReview(service, "create-proposal-only");

    expect(created.request).toMatchObject({
      state: "REVIEW",
      ownerId: null,
      assigneeId: null,
      assignmentId: null
    });
    expect(created.evaluation.proposal).not.toBeNull();
    expect(await approvalApi(service).listApprovals(owner)).toEqual([]);
    expect(await approvalApi(service).listAssignments(owner)).toEqual([]);
  });

  it("forbids a Viewer without changing request state or event sequence", async () => {
    const service = createService();
    const created = await createReview(service, "create-viewer-denied");
    const beforeAudit = await service.listAudit(intakeActor);

    await expect(
      approvalApi(service).approveProposal(
        viewer,
        commandFor(created.request, created.evaluation.proposal!, "DEMO: viewer must not approve."),
        "approve-viewer-denied"
      )
    ).rejects.toThrow("ServiceFlow approval is forbidden");

    expect(await service.getRequest(intakeActor, created.request.id)).toEqual(created.request);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);
    expect(await approvalApi(service).listApprovals(owner)).toEqual([]);
    expect(await approvalApi(service).listAssignments(owner)).toEqual([]);
  });

  it("rejects an actor without an approval role and a missing human reason before mutation", async () => {
    const service = createService();
    const created = await createReview(service, "create-invalid-approval-input");
    const beforeAudit = await service.listAudit(intakeActor);
    const command = commandFor(created.request, created.evaluation.proposal!, "DEMO: valid reason.");

    await expect(
      approvalApi(service).approveProposal(
        { tenantId: tenantA, actorId: "roleless-demo" } as ApprovalActor,
        command,
        "approve-roleless"
      )
    ).rejects.toThrow();
    await expect(
      approvalApi(service).approveProposal(owner, { ...command, reason: "" }, "approve-no-reason")
    ).rejects.toThrow();

    expect(await service.getRequest(intakeActor, created.request.id)).toEqual(created.request);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);
  });

  it("fails closed for cross-tenant approval without disclosing or mutating the request", async () => {
    const service = createService();
    const created = await createReview(service, "create-cross-tenant");
    const beforeAudit = await service.listAudit(intakeActor);

    await expect(
      approvalApi(service).approveProposal(
        otherTenantOwner,
        commandFor(created.request, created.evaluation.proposal!, "DEMO: cross-tenant attempt."),
        "approve-cross-tenant"
      )
    ).rejects.toThrow("Service request not found");

    expect(await service.getRequest(intakeActor, created.request.id)).toEqual(created.request);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);
    expect(await service.listAudit({ tenantId: tenantB, actorId: "reader-demo-b" })).toEqual([]);
    expect(await approvalApi(service).listApprovals(otherTenantOwner)).toEqual([]);
    expect(await approvalApi(service).listAssignments(otherTenantOwner)).toEqual([]);
  });

  it("replays approve idempotently without duplicate approval, assignment, or audit events", async () => {
    const service = createService();
    const created = await createReview(service, "create-approve-replay");
    const command = commandFor(
      created.request,
      created.evaluation.proposal!,
      "DEMO: approve once and replay safely."
    );

    const first = await approvalApi(service).approveProposal(owner, command, "approve-replay-001");
    const auditAfterFirst = await service.listAudit(intakeActor);
    const replay = await approvalApi(service).approveProposal(
      owner,
      { ...command, reason: "  DEMO: approve once and replay safely.  " },
      "approve-replay-001"
    );

    expect(replay).toEqual(first);
    expect(await approvalApi(service).listApprovals(owner)).toHaveLength(1);
    expect(await approvalApi(service).listAssignments(owner)).toHaveLength(1);
    expect(await service.listAudit(intakeActor)).toEqual(auditAfterFirst);
  });

  it("rejects reuse of an approval idempotency key for a different command without mutation", async () => {
    const service = createService();
    const created = await createReview(service, "create-approve-key-collision");
    const proposal = created.evaluation.proposal!;
    const command = commandFor(created.request, proposal, "DEMO: original approval reason.");
    await approvalApi(service).approveProposal(owner, command, "approve-key-collision");
    const beforeAudit = await service.listAudit(intakeActor);

    await expect(
      approvalApi(service).approveProposal(
        owner,
        { ...command, reason: "DEMO: conflicting approval reason." },
        "approve-key-collision"
      )
    ).rejects.toThrow("Approval idempotency key is already bound to a different command");

    expect(await approvalApi(service).listApprovals(owner)).toHaveLength(1);
    expect(await approvalApi(service).listAssignments(owner)).toHaveLength(1);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);
  });

  it("binds an approval idempotency key to the approving principal", async () => {
    const service = createService();
    const created = await createReview(service, "create-approval-principal-binding");
    const command = commandFor(
      created.request,
      created.evaluation.proposal!,
      "DEMO: owner authorizes this assignment."
    );
    await approvalApi(service).approveProposal(owner, command, "approve-principal-binding");
    const beforeAudit = await service.listAudit(intakeActor);

    await expect(
      approvalApi(service).approveProposal(operator, command, "approve-principal-binding")
    ).rejects.toThrow("Approval idempotency key is already bound to a different command");

    expect(await approvalApi(service).listApprovals(owner)).toHaveLength(1);
    expect(await approvalApi(service).listAssignments(owner)).toHaveLength(1);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);
  });

  it("does not let re-evaluation move an assigned request back to review", async () => {
    const service = createService();
    const created = await createReview(service, "create-assigned-re-evaluate");
    const approved = await approvalApi(service).approveProposal(
      owner,
      commandFor(
        created.request,
        created.evaluation.proposal!,
        "DEMO: assign before invalid re-evaluation."
      ),
      "approve-before-re-evaluate"
    );
    const beforeAudit = await service.listAudit(intakeActor);

    await expect(service.reEvaluate(intakeActor, approved.request.id)).rejects.toThrow(
      "Invalid ServiceFlow transition"
    );

    expect(await service.getRequest(intakeActor, approved.request.id)).toEqual(approved.request);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);
  });

  it.each([
    ["stale revision", { requestRevision: 1 }],
    ["wrong technician", { technicianId: "DEMO_TECHNICIAN_TAMPERED" }],
    ["wrong policy", { proposalPolicyVersion: "serviceflow-policy-stale" }],
    ["wrong rule", { proposalRuleVersion: "assignee-proposal-stale" }]
  ] as const)("rejects a stale or unsafe proposal for %s", async (_name, override) => {
    const service = createService();
    const created = await createReview(service, `create-unsafe-${_name}`.replaceAll(" ", "-"));
    const proposal = created.evaluation.proposal!;
    let request = created.request;
    if (_name === "stale revision") {
      const reevaluated = await service.reEvaluate(intakeActor, created.request.id);
      request = reevaluated.request;
    }
    const beforeRequest = await service.getRequest(intakeActor, request.id);

    await expect(
      approvalApi(service).approveProposal(
        owner,
        { ...commandFor(request, proposal, "DEMO: stale or unsafe proposal."), ...override },
        `approve-unsafe-${_name}`.replaceAll(" ", "-")
      )
    ).rejects.toThrow("Assignment proposal is stale or unsafe");

    expect(await service.getRequest(intakeActor, request.id)).toEqual(beforeRequest);
    expect(await approvalApi(service).listAssignments(owner)).toEqual([]);
    expect(await service.listAudit(intakeActor)).toContainEqual(
      expect.objectContaining({
        type: "APPROVAL_REJECTED",
        details: expect.objectContaining({ reasonCode: "STALE_OR_UNSAFE_PROPOSAL" })
      })
    );
  });

  it("rejects approval from a blocked state, records the invalid transition reason, and preserves state", async () => {
    const service = createService();
    const blocked = await service.createAndEvaluate(
      intakeActor,
      { ...baseInput, service: "ROOF_REPLACEMENT" },
      "create-blocked-transition"
    );

    await expect(
      approvalApi(service).approveProposal(
        owner,
        {
          requestId: blocked.request.id,
          requestRevision: requestRevision(blocked.request),
          technicianId: "DEMO_TECHNICIAN_ALPHA",
          proposalPolicyVersion: "serviceflow-policy-v1",
          proposalRuleVersion: "assignee-proposal-v1",
          reason: "DEMO: invalid blocked transition."
        },
        "approve-blocked-transition"
      )
    ).rejects.toThrow("Invalid ServiceFlow transition");

    expect((await service.getRequest(intakeActor, blocked.request.id)).state).toBe("BLOCKED");
    expect(await approvalApi(service).listAssignments(owner)).toEqual([]);
    expect((await service.listAudit(intakeActor)).at(-1)).toMatchObject({
      type: "APPROVAL_REJECTED",
      details: { fromState: "BLOCKED", reasonCode: "INVALID_TRANSITION" }
    });
  });

  it("rolls back approval, assignment, idempotency, and audit when approval staging fails", async () => {
    const service = createService(
      sequenceId([
        "request-atomic-approval",
        "event-create-1",
        "event-create-2",
        "approval-first",
        "assignment-first",
        "event-create-1",
        "approval-retry",
        "assignment-retry",
        "event-approve-retry",
        "event-assignment-retry"
      ])
    );
    const created = await createReview(service, "create-atomic-approval");
    const command = commandFor(
      created.request,
      created.evaluation.proposal!,
      "DEMO: approval must commit atomically."
    );
    const beforeAudit = await service.listAudit(intakeActor);

    await expect(
      approvalApi(service).approveProposal(owner, command, "approve-atomic-001")
    ).rejects.toThrow("ServiceFlow audit event id collision");

    expect(await service.getRequest(intakeActor, created.request.id)).toEqual(created.request);
    expect(await approvalApi(service).listApprovals(owner)).toEqual([]);
    expect(await approvalApi(service).listAssignments(owner)).toEqual([]);
    expect(await service.listAudit(intakeActor)).toEqual(beforeAudit);

    await expect(
      approvalApi(service).approveProposal(owner, command, "approve-atomic-001")
    ).resolves.toMatchObject({ request: { state: "ASSIGNED" } });
  });
});

function createService(id: () => string = serialId()): ServiceFlowService {
  let tick = 0;
  return new ServiceFlowService(
    new InMemoryServiceFlowRepository({
      id,
      now: () => new Date(1_780_000_000_000 + tick++)
    })
  );
}

async function createReview(service: ServiceFlowService, key: string) {
  const result = await service.createAndEvaluate(intakeActor, baseInput, key);
  expect(result.request.state).toBe("REVIEW");
  expect(result.evaluation.proposal).not.toBeNull();
  return result;
}

function commandFor(
  request: Pick<ServiceRequest, "id" | "revision">,
  proposal: { technicianId: string; policyVersion: string; ruleVersion: string },
  reason: string
): ApproveProposalCommand {
  return {
    requestId: request.id,
    requestRevision: requestRevision(request),
    technicianId: proposal.technicianId,
    proposalPolicyVersion: proposal.policyVersion,
    proposalRuleVersion: proposal.ruleVersion,
    reason
  };
}

function requestRevision(request: Pick<ServiceRequest, "id" | "revision">): number {
  return request.revision;
}

function approvalApi(service: ServiceFlowService): ServiceFlowService {
  return service;
}

function serialId(): () => string {
  let serial = 0;
  return () => `serviceflow-1b-${++serial}`;
}

function sequenceId(values: string[]): () => string {
  return () => {
    const value = values.shift();
    if (!value) throw new Error("Unexpected generated id request");
    return value;
  };
}
