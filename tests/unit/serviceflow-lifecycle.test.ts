import { describe, expect, it } from "vitest";
import {
  InMemoryServiceFlowRepository,
  ServiceFlowService,
  type ApprovalActor,
  type AttachCompletionEvidenceCommand,
  type LifecycleCommand,
  type ServiceRequest,
  type ServiceRequestInput
} from "@/modules/serviceflow";

const tenantA = "tenant-demo-a";
const tenantB = "tenant-demo-b";
const intakeActor = { tenantId: tenantA, actorId: "intake-demo-a" };
const owner: ApprovalActor = {
  tenantId: tenantA,
  actorId: "owner-demo-a",
  role: "OWNER"
};
const operator: ApprovalActor = {
  tenantId: tenantA,
  actorId: "operator-demo-a",
  role: "OPERATOR"
};
const viewer: ApprovalActor = {
  tenantId: tenantA,
  actorId: "viewer-demo-a",
  role: "VIEWER"
};
const otherTenantOwner: ApprovalActor = {
  tenantId: tenantB,
  actorId: "owner-demo-b",
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

describe("ServiceFlow request lifecycle", () => {
  it("starts, attaches internal synthetic evidence, completes, and closes with an audited chain", async () => {
    const service = createService();
    const assigned = await prepareAssigned(service, "happy");

    const started = await service.startRequest(
      operator,
      commandFor(assigned, "DEMO: operator starts the assigned work."),
      "start-happy-001"
    );
    const evidenceResult = await service.attachCompletionEvidence(
      operator,
      evidenceFor(started.request),
      "evidence-happy-001"
    );
    const completed = await service.completeRequest(
      operator,
      commandFor(
        evidenceResult.request,
        "DEMO: synthetic work and evidence verified."
      ),
      "complete-happy-001"
    );
    const closed = await service.closeRequest(
      owner,
      commandFor(
        completed.request,
        "DEMO: owner reviewed completion and closes the request."
      ),
      "close-happy-001"
    );

    expect(started.request).toMatchObject({
      state: "IN_PROGRESS",
      revision: 3
    });
    expect(evidenceResult.request).toMatchObject({
      state: "IN_PROGRESS",
      revision: 4
    });
    expect(evidenceResult.evidence).toMatchObject({
      tenantId: tenantA,
      requestId: assigned.id,
      assignmentId: assigned.assignmentId,
      type: "DEMO_INTERNAL_FIXTURE",
      assetId: "DEMO_EVIDENCE_FIXTURE_COMPLETION_01",
      attachedBy: operator.actorId,
      createdAt: "2026-05-30T00:13:20.009Z"
    });
    expect(completed.request).toMatchObject({
      state: "COMPLETED",
      revision: 5
    });
    expect(closed.request).toMatchObject({ state: "CLOSED", revision: 6 });
    expect(closed.outboundActionCount).toBe(0);

    expect((await service.listAudit(owner)).slice(-4)).toEqual([
      expect.objectContaining({
        type: "REQUEST_STARTED",
        actorId: operator.actorId,
        details: expect.objectContaining({
          fromState: "ASSIGNED",
          toState: "IN_PROGRESS"
        })
      }),
      expect.objectContaining({
        type: "COMPLETION_EVIDENCE_ATTACHED",
        actorId: operator.actorId,
        details: expect.objectContaining({
          fromState: "IN_PROGRESS",
          toState: "IN_PROGRESS",
          evidenceType: "DEMO_INTERNAL_FIXTURE"
        })
      }),
      expect.objectContaining({
        type: "REQUEST_COMPLETED",
        actorId: operator.actorId,
        details: expect.objectContaining({
          fromState: "IN_PROGRESS",
          toState: "COMPLETED",
          reason: "DEMO: synthetic work and evidence verified."
        })
      }),
      expect.objectContaining({
        type: "REQUEST_CLOSED",
        actorId: owner.actorId,
        details: expect.objectContaining({
          fromState: "COMPLETED",
          toState: "CLOSED",
          reason: "DEMO: owner reviewed completion and closes the request."
        })
      })
    ]);
  });

  it("blocks and resumes in-progress work only with an audited human reason", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(service, "block-resume");

    const blocked = await service.blockRequest(
      operator,
      commandFor(
        inProgress,
        "DEMO: synthetic access to the work area is temporarily blocked."
      ),
      "block-work-001"
    );
    expect(blocked.request).toMatchObject({
      state: "BLOCKED",
      revision: 4,
      operationalBlockReason:
        "DEMO: synthetic access to the work area is temporarily blocked."
    });

    const resumed = await service.resumeRequest(
      owner,
      commandFor(
        blocked.request,
        "DEMO: owner confirms the synthetic access issue is resolved."
      ),
      "resume-work-001"
    );
    expect(resumed.request).toMatchObject({
      state: "IN_PROGRESS",
      revision: 5,
      operationalBlockReason: null
    });
    expect((await service.listAudit(owner)).slice(-2)).toEqual([
      expect.objectContaining({
        type: "REQUEST_BLOCKED",
        details: expect.objectContaining({
          reason:
            "DEMO: synthetic access to the work area is temporarily blocked."
        })
      }),
      expect.objectContaining({
        type: "REQUEST_RESUMED",
        details: expect.objectContaining({
          reason: "DEMO: owner confirms the synthetic access issue is resolved."
        })
      })
    ]);
  });

  it("rejects missing block or resume reasons before mutation", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(service, "missing-reason");
    const beforeBlockAudit = await service.listAudit(owner);

    await expect(
      service.blockRequest(
        operator,
        commandFor(inProgress, ""),
        "block-missing-reason"
      )
    ).rejects.toThrow();
    expect(await service.getRequest(owner, inProgress.id)).toEqual(inProgress);
    expect(await service.listAudit(owner)).toEqual(beforeBlockAudit);

    const blocked = await service.blockRequest(
      operator,
      commandFor(
        inProgress,
        "DEMO: synthetic dependency is temporarily unavailable."
      ),
      "block-valid-reason"
    );
    const beforeResumeAudit = await service.listAudit(owner);
    await expect(
      service.resumeRequest(
        owner,
        commandFor(blocked.request, "   "),
        "resume-missing-reason"
      )
    ).rejects.toThrow();
    expect(await service.getRequest(owner, blocked.request.id)).toEqual(
      blocked.request
    );
    expect(await service.listAudit(owner)).toEqual(beforeResumeAudit);
  });

  it.each([
    [
      "emergency signal",
      {
        ...safeInput,
        description: "DEMO: there is a gas leak and an immediate hazard."
      },
      "POSSIBLE_EMERGENCY"
    ],
    [
      "unknown safety",
      { ...safeInput, safetyAssessment: "UNKNOWN" as const },
      "SAFETY_UNKNOWN"
    ]
  ] as const)(
    "never resumes or advances a request blocked by %s",
    async (_name, input, reason) => {
      const service = createService();
      const hazardous = await service.createAndEvaluate(
        intakeActor,
        input,
        `create-hazardous-lifecycle-${reason.toLowerCase()}`
      );
      expect(hazardous.request.state).toBe("BLOCKED");

      await expect(
        service.resumeRequest(
          owner,
          commandFor(
            hazardous.request,
            "DEMO: unsafe intake blocks cannot be bypassed."
          ),
          `resume-hazardous-${reason.toLowerCase()}`
        )
      ).rejects.toThrow("Safety-blocked ServiceFlow request cannot resume");
      await expect(
        service.attachCompletionEvidence(
          owner,
          evidenceFor(hazardous.request),
          `evidence-hazardous-${reason.toLowerCase()}`
        )
      ).rejects.toThrow("Invalid ServiceFlow transition");

      expect(
        (await service.getRequest(owner, hazardous.request.id)).state
      ).toBe("BLOCKED");
      expect(await service.listCompletionEvidence(owner)).toEqual([]);
      expect(await service.listAudit(owner)).toContainEqual(
        expect.objectContaining({
          type: "LIFECYCLE_COMMAND_REJECTED",
          details: expect.objectContaining({
            reasonCode: "SAFETY_BLOCK_CANNOT_RESUME"
          })
        })
      );
    }
  );

  it("rejects completion without evidence and preserves the in-progress state", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(
      service,
      "complete-without-evidence"
    );

    await expect(
      service.completeRequest(
        operator,
        commandFor(inProgress, "DEMO: completion must fail without evidence."),
        "complete-without-evidence"
      )
    ).rejects.toThrow("Completion evidence is required");

    expect(await service.getRequest(owner, inProgress.id)).toEqual(inProgress);
    expect((await service.listAudit(owner)).at(-1)).toMatchObject({
      type: "LIFECYCLE_COMMAND_REJECTED",
      details: { reasonCode: "MISSING_COMPLETION_EVIDENCE" }
    });
  });

  it("rejects external, URL, or non-fixture completion evidence before mutation", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(service, "external-evidence");
    const beforeAudit = await service.listAudit(owner);

    await expect(
      service.attachCompletionEvidence(
        operator,
        {
          requestId: inProgress.id,
          requestRevision: inProgress.revision,
          evidenceType: "EXTERNAL_URL",
          evidenceAssetId: "https://example.test/evidence.jpg"
        } as unknown as AttachCompletionEvidenceCommand,
        "evidence-external-001"
      )
    ).rejects.toThrow();

    expect(await service.getRequest(owner, inProgress.id)).toEqual(inProgress);
    expect(await service.listCompletionEvidence(owner)).toEqual([]);
    expect(await service.listAudit(owner)).toEqual(beforeAudit);
  });

  it("forbids Viewer lifecycle mutations without changing state or event sequence", async () => {
    const service = createService();
    const assigned = await prepareAssigned(service, "viewer");
    const beforeAudit = await service.listAudit(owner);

    await expect(
      service.startRequest(
        viewer,
        commandFor(assigned, "DEMO: viewer must not start assigned work."),
        "start-viewer-denied"
      )
    ).rejects.toThrow("ServiceFlow lifecycle mutation is forbidden");

    expect(await service.getRequest(owner, assigned.id)).toEqual(assigned);
    expect(await service.listAudit(owner)).toEqual(beforeAudit);
  });

  it("fails closed across tenants without disclosing or mutating lifecycle state", async () => {
    const service = createService();
    const assigned = await prepareAssigned(service, "cross-tenant");
    const beforeAudit = await service.listAudit(owner);

    await expect(
      service.startRequest(
        otherTenantOwner,
        commandFor(assigned, "DEMO: cross-tenant lifecycle attempt."),
        "start-cross-tenant"
      )
    ).rejects.toThrow("Service request not found");

    expect(await service.getRequest(owner, assigned.id)).toEqual(assigned);
    expect(await service.listAudit(owner)).toEqual(beforeAudit);
    expect(await service.listAudit(otherTenantOwner)).toEqual([]);
  });

  it("replays evidence idempotently and binds the key to the original principal and command", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(service, "evidence-replay");
    const command = evidenceFor(inProgress);

    const first = await service.attachCompletionEvidence(
      owner,
      command,
      "evidence-replay-001"
    );
    const auditAfterFirst = await service.listAudit(owner);
    const replay = await service.attachCompletionEvidence(
      owner,
      command,
      "evidence-replay-001"
    );
    expect(replay).toEqual(first);
    expect(await service.listCompletionEvidence(owner)).toHaveLength(1);
    expect(await service.listAudit(owner)).toEqual(auditAfterFirst);

    await expect(
      service.attachCompletionEvidence(operator, command, "evidence-replay-001")
    ).rejects.toThrow(
      "Lifecycle idempotency key is already bound to a different principal or command"
    );
    await expect(
      service.attachCompletionEvidence(
        owner,
        { ...command, evidenceAssetId: "DEMO_EVIDENCE_FIXTURE_COMPLETION_02" },
        "evidence-replay-001"
      )
    ).rejects.toThrow(
      "Lifecycle idempotency key is already bound to a different principal or command"
    );
    expect(await service.listCompletionEvidence(owner)).toHaveLength(1);
    expect(await service.listAudit(owner)).toEqual(auditAfterFirst);
  });

  it("rejects and idempotently audits a stale lifecycle revision without state mutation", async () => {
    const service = createService();
    const assigned = await prepareAssigned(service, "stale-start");
    const command = {
      ...commandFor(
        assigned,
        "DEMO: stale lifecycle command must not start work."
      ),
      requestRevision: assigned.revision - 1
    };

    await expect(
      service.startRequest(owner, command, "start-stale-001")
    ).rejects.toThrow("ServiceFlow request revision is stale");
    const auditAfterFirst = await service.listAudit(owner);
    expect(await service.getRequest(owner, assigned.id)).toEqual(assigned);
    expect(auditAfterFirst.at(-1)).toMatchObject({
      type: "LIFECYCLE_COMMAND_REJECTED",
      details: { reasonCode: "STALE_REQUEST_REVISION" }
    });

    await expect(
      service.startRequest(owner, command, "start-stale-001")
    ).rejects.toThrow("ServiceFlow request revision is stale");
    expect(await service.listAudit(owner)).toEqual(auditAfterFirst);
  });

  it("rejects close from in-progress, audits the reason, and preserves state atomically", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(service, "invalid-close");

    await expect(
      service.closeRequest(
        owner,
        commandFor(inProgress, "DEMO: invalid close must be rejected."),
        "close-invalid-transition"
      )
    ).rejects.toThrow("Invalid ServiceFlow transition");

    expect(await service.getRequest(owner, inProgress.id)).toEqual(inProgress);
    expect((await service.listAudit(owner)).at(-1)).toMatchObject({
      type: "LIFECYCLE_COMMAND_REJECTED",
      details: { reasonCode: "INVALID_TRANSITION", fromState: "IN_PROGRESS" }
    });
  });

  it("does not let re-evaluation bypass an active or terminal lifecycle state", async () => {
    const service = createService();
    const inProgress = await prepareInProgress(
      service,
      "lifecycle-re-evaluate"
    );
    const beforeAudit = await service.listAudit(owner);

    await expect(service.reEvaluate(owner, inProgress.id)).rejects.toThrow(
      "Invalid ServiceFlow transition"
    );

    expect(await service.getRequest(owner, inProgress.id)).toEqual(inProgress);
    expect(await service.listAudit(owner)).toEqual(beforeAudit);
  });

  it("rolls back start state and idempotency when audit staging fails, then permits retry", async () => {
    const service = createService(
      sequenceId([
        "request-lifecycle-atomic",
        "event-create-1",
        "event-create-2",
        "approval-lifecycle-atomic",
        "assignment-lifecycle-atomic",
        "event-approve",
        "event-assign",
        "event-create-1",
        "event-start-retry"
      ])
    );
    const assigned = await prepareAssigned(service, "atomic-start");
    const beforeAudit = await service.listAudit(owner);
    const command = commandFor(assigned, "DEMO: start must commit atomically.");

    await expect(
      service.startRequest(owner, command, "start-atomic-001")
    ).rejects.toThrow("ServiceFlow audit event id collision");
    expect(await service.getRequest(owner, assigned.id)).toEqual(assigned);
    expect(await service.listAudit(owner)).toEqual(beforeAudit);

    await expect(
      service.startRequest(owner, command, "start-atomic-001")
    ).resolves.toMatchObject({ request: { state: "IN_PROGRESS" } });
  });
});

function createService(id: () => string = serialId()): ServiceFlowService {
  let tick = 0;
  return new ServiceFlowService(
    new InMemoryServiceFlowRepository({
      id,
      now: () => new Date(1_780_100_000_000 + tick++)
    })
  );
}

async function prepareAssigned(
  service: ServiceFlowService,
  suffix: string
): Promise<ServiceRequest> {
  const created = await service.createAndEvaluate(
    intakeActor,
    safeInput,
    `create-${suffix}`
  );
  const proposal = created.evaluation.proposal!;
  const approved = await service.approveProposal(
    owner,
    {
      requestId: created.request.id,
      requestRevision: created.request.revision,
      technicianId: proposal.technicianId,
      proposalPolicyVersion: proposal.policyVersion,
      proposalRuleVersion: proposal.ruleVersion,
      reason: "DEMO: owner approves the synthetic assignment."
    },
    `approve-${suffix}`
  );
  return approved.request;
}

async function prepareInProgress(
  service: ServiceFlowService,
  suffix: string
): Promise<ServiceRequest> {
  const assigned = await prepareAssigned(service, suffix);
  return (
    await service.startRequest(
      operator,
      commandFor(assigned, "DEMO: operator starts synthetic assigned work."),
      `start-${suffix}`
    )
  ).request;
}

function commandFor(request: ServiceRequest, reason: string): LifecycleCommand {
  return { requestId: request.id, requestRevision: request.revision, reason };
}

function evidenceFor(request: ServiceRequest): AttachCompletionEvidenceCommand {
  return {
    requestId: request.id,
    requestRevision: request.revision,
    evidenceType: "DEMO_INTERNAL_FIXTURE",
    evidenceAssetId: "DEMO_EVIDENCE_FIXTURE_COMPLETION_01"
  };
}

function serialId(): () => string {
  let serial = 0;
  return () => `serviceflow-1c-${++serial}`;
}

function sequenceId(values: string[]): () => string {
  return () => {
    const value = values.shift();
    if (!value) throw new Error("Unexpected generated id request");
    return value;
  };
}
