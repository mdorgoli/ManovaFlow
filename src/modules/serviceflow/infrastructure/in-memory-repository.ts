import { randomUUID } from "node:crypto";
import {
  APPROVAL_FORBIDDEN,
  APPROVAL_IDEMPOTENCY_CONFLICT,
  COMPLETION_EVIDENCE_REQUIRED,
  INVALID_TRANSITION,
  LIFECYCLE_FORBIDDEN,
  LIFECYCLE_IDEMPOTENCY_CONFLICT,
  SAFETY_BLOCK_CANNOT_RESUME,
  SERVICE_REQUEST_NOT_FOUND,
  STALE_REQUEST_REVISION,
  STALE_OR_UNSAFE_PROPOSAL,
  type ServiceFlowRepository
} from "../application/repository";
import { generatedRequestIdSchema } from "../domain/schema";
import type {
  ApprovalActor,
  ApproveProposalCommand,
  ApproveProposalResult,
  AttachCompletionEvidenceCommand,
  AttachCompletionEvidenceResult,
  Assignment,
  AssignmentApproval,
  BlockReason,
  CompletionEvidence,
  CreateServiceRequestResult,
  DemoResetCasePlan,
  LifecycleAction,
  LifecycleCommand,
  LifecycleCommandResult,
  RequestEvaluation,
  ServiceFlowActor,
  ServiceFlowEvent,
  ServiceFlowMutationActor,
  ServiceFlowSnapshot,
  ServiceRequest,
  ServiceRequestInput
} from "../domain/types";

interface InMemoryServiceFlowRepositoryOptions {
  now?: () => Date;
  id?: () => string;
}

interface StoredRequest {
  request: ServiceRequest;
  evaluation: RequestEvaluation;
}

interface IdempotencyRecord {
  normalizedPayload: string;
  result: CreateServiceRequestResult;
}

interface ApprovalIdempotencyRecord {
  normalizedCommand: string;
  result: ApproveProposalResult;
}

type LifecycleStoredResult = LifecycleCommandResult | AttachCompletionEvidenceResult;

interface LifecycleIdempotencyRecord {
  normalizedCommand: string;
  result?: LifecycleStoredResult;
  errorMessage?: string;
}

export class InMemoryServiceFlowRepository implements ServiceFlowRepository {
  readonly #now: () => Date;
  readonly #id: () => string;
  readonly #requests = new Map<string, StoredRequest>();
  readonly #idempotency = new Map<string, IdempotencyRecord>();
  readonly #approvalIdempotency = new Map<string, ApprovalIdempotencyRecord>();
  readonly #lifecycleIdempotency = new Map<string, LifecycleIdempotencyRecord>();
  readonly #approvals = new Map<string, AssignmentApproval>();
  readonly #assignments = new Map<string, Assignment>();
  readonly #completionEvidence = new Map<string, CompletionEvidence>();
  readonly #audit: ServiceFlowEvent[] = [];
  readonly #tenantSequence = new Map<string, number>();
  readonly #auditEventIds = new Set<string>();
  readonly #approvalIds = new Set<string>();
  readonly #assignmentIds = new Set<string>();
  readonly #completionEvidenceIds = new Set<string>();

  constructor(options: InMemoryServiceFlowRepositoryOptions = {}) {
    this.#now = options.now ?? (() => new Date());
    this.#id = options.id ?? randomUUID;
  }

  async createOrReuse(
    actor: ServiceFlowActor,
    idempotencyKey: string,
    normalizedPayload: string,
    input: ServiceRequestInput,
    evaluation: RequestEvaluation,
    state: ServiceRequest["state"]
  ): Promise<CreateServiceRequestResult> {
    const key = idempotencyMapKey(actor.tenantId, idempotencyKey);
    const existing = this.#idempotency.get(key);
    if (existing) {
      if (existing.normalizedPayload !== normalizedPayload) {
        throw new Error("Idempotency key is already bound to a different request payload");
      }
      return clone(existing.result);
    }

    const parsedRequestId = generatedRequestIdSchema.safeParse(this.#id());
    if (!parsedRequestId.success) {
      throw new Error("Invalid generated service request id");
    }
    const requestId = parsedRequestId.data;
    if (this.#requests.has(requestMapKey(actor.tenantId, requestId))) {
      throw new Error("Service request id collision");
    }

    const createdAt = this.#timestamp();
    const request: ServiceRequest = {
      id: requestId,
      tenantId: actor.tenantId,
      state,
      revision: 1,
      input: clone(input),
      ownerId: null,
      assigneeId: null,
      assignmentId: null,
      operationalBlockReason: null,
      completionEvidenceIds: [],
      createdAt,
      updatedAt: createdAt
    };
    const result: CreateServiceRequestResult = {
      request: clone(request),
      evaluation: clone(evaluation),
      outboundActionCount: 0
    };
    const stagedRequest: StoredRequest = {
      request: clone(request),
      evaluation: clone(evaluation)
    };
    const stagedIdempotency: IdempotencyRecord = {
      normalizedPayload,
      result: clone(result)
    };
    const nextSequence = (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1;
    const stagedEventIds = new Set<string>();
    const createdEvent = this.#stageAuditEvent(
      actor,
      request.id,
      "REQUEST_CREATED",
      { state: "NEW", synthetic: true },
      nextSequence,
      stagedEventIds
    );
    const evaluatedEvent = this.#stageAuditEvent(
      actor,
      request.id,
      "REQUEST_EVALUATED",
      evaluationDetails("NEW", state, evaluation),
      nextSequence + 1,
      stagedEventIds
    );

    this.#requests.set(requestMapKey(actor.tenantId, request.id), stagedRequest);
    this.#idempotency.set(key, stagedIdempotency);
    this.#audit.push(createdEvent, evaluatedEvent);
    this.#tenantSequence.set(actor.tenantId, evaluatedEvent.sequence);
    this.#auditEventIds.add(createdEvent.id);
    this.#auditEventIds.add(evaluatedEvent.id);
    return clone(result);
  }

  async getRequest(actor: ServiceFlowActor, requestId: string): Promise<ServiceRequest> {
    return clone(this.#requireRequest(actor, requestId).request);
  }

  async listRequests(actor: ServiceFlowActor): Promise<ServiceRequest[]> {
    return [...this.#requests.values()]
      .map((stored) => stored.request)
      .filter((request) => request.tenantId === actor.tenantId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map(clone);
  }

  async listAudit(actor: ServiceFlowActor): Promise<ServiceFlowEvent[]> {
    return this.#audit
      .filter((event) => event.tenantId === actor.tenantId)
      .sort((left, right) => left.sequence - right.sequence)
      .map(clone);
  }

  async getExceptionCount(
    actor: ServiceFlowActor,
    reason: BlockReason
  ): Promise<number> {
    return [...this.#requests.values()].filter(
      (stored) =>
        stored.request.tenantId === actor.tenantId &&
        stored.request.state === "BLOCKED" &&
        stored.evaluation.blockReason === reason
    ).length;
  }

  async listApprovals(actor: ServiceFlowActor): Promise<AssignmentApproval[]> {
    return [...this.#approvals.values()]
      .filter((approval) => approval.tenantId === actor.tenantId)
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      )
      .map(clone);
  }

  async listAssignments(actor: ServiceFlowActor): Promise<Assignment[]> {
    return [...this.#assignments.values()]
      .filter((assignment) => assignment.tenantId === actor.tenantId)
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      )
      .map(clone);
  }

  async listCompletionEvidence(actor: ServiceFlowActor): Promise<CompletionEvidence[]> {
    return [...this.#completionEvidence.values()]
      .filter((evidence) => evidence.tenantId === actor.tenantId)
      .sort(
        (left, right) =>
          left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
      )
      .map(clone);
  }

  async getSnapshot(actor: ServiceFlowActor): Promise<ServiceFlowSnapshot> {
    const cases = [...this.#requests.values()]
      .filter((stored) => stored.request.tenantId === actor.tenantId)
      .sort(
        (left, right) =>
          left.request.createdAt.localeCompare(right.request.createdAt) ||
          left.request.id.localeCompare(right.request.id)
      )
      .map((stored) => ({
        request: clone(stored.request),
        evaluation: clone(stored.evaluation)
      }));
    return {
      cases,
      approvals: await this.listApprovals(actor),
      assignments: await this.listAssignments(actor),
      completionEvidence: await this.listCompletionEvidence(actor),
      audit: await this.listAudit(actor),
      outboundActionCount: 0
    };
  }

  async resetDemoTenant(
    actor: ServiceFlowMutationActor,
    cases: readonly DemoResetCasePlan[]
  ): Promise<ServiceFlowSnapshot> {
    if (actor.role === "VIEWER") {
      throw new Error(LIFECYCLE_FORBIDDEN);
    }
    assertDeterministicResetPlan(cases);

    const stagedRequests = new Map<string, StoredRequest>();
    const stagedEvents: ServiceFlowEvent[] = [];
    const occupiedEventIds = new Set(
      this.#audit
        .filter((event) => event.tenantId !== actor.tenantId)
        .map((event) => event.id)
    );
    const stageEvent = (
      suffix: string,
      sequence: number,
      requestId: string,
      type: ServiceFlowEvent["type"],
      details: Record<string, unknown>,
      createdAt: string
    ) => {
      const id = deterministicDemoId(actor.tenantId, `EVENT_${suffix}`);
      if (occupiedEventIds.has(id)) {
        throw new Error("ServiceFlow deterministic reset event id collision");
      }
      occupiedEventIds.add(id);
      stagedEvents.push({
        id,
        tenantId: actor.tenantId,
        sequence,
        requestId,
        type,
        actorId: actor.actorId,
        details: clone(details),
        createdAt
      });
    };

    const resetRequestId = deterministicDemoId(actor.tenantId, "RESET");
    stageEvent(
      "RESET",
      1,
      resetRequestId,
      "DEMO_TENANT_RESET",
      { synthetic: true, caseCount: 2, outboundActionCount: 0 },
      deterministicResetTimestamp(0)
    );

    cases.forEach((item, index) => {
      const requestId = deterministicDemoId(actor.tenantId, `REQUEST_${item.key}_001`);
      const createdAt = deterministicResetTimestamp(index * 2 + 1);
      const request: ServiceRequest = {
        id: requestId,
        tenantId: actor.tenantId,
        state: item.state,
        revision: 1,
        input: clone(item.input),
        ownerId: null,
        assigneeId: null,
        assignmentId: null,
        operationalBlockReason: null,
        completionEvidenceIds: [],
        createdAt,
        updatedAt: createdAt
      };
      stagedRequests.set(requestMapKey(actor.tenantId, requestId), {
        request: clone(request),
        evaluation: clone(item.evaluation)
      });
      stageEvent(
        `${item.key}_CREATED`,
        index * 2 + 2,
        requestId,
        "REQUEST_CREATED",
        { state: "NEW", synthetic: true, deterministicReset: true },
        createdAt
      );
      stageEvent(
        `${item.key}_EVALUATED`,
        index * 2 + 3,
        requestId,
        "REQUEST_EVALUATED",
        evaluationDetails("NEW", item.state, item.evaluation),
        deterministicResetTimestamp(index * 2 + 2)
      );
    });

    this.#clearTenantState(actor.tenantId);
    for (const [key, stored] of stagedRequests) {
      this.#requests.set(key, stored);
    }
    this.#audit.push(...stagedEvents);
    for (const event of stagedEvents) this.#auditEventIds.add(event.id);
    this.#tenantSequence.set(actor.tenantId, stagedEvents.at(-1)?.sequence ?? 0);
    return this.getSnapshot(actor);
  }

  async approveProposal(
    actor: ApprovalActor,
    command: ApproveProposalCommand,
    idempotencyKey: string,
    normalizedCommand: string
  ): Promise<ApproveProposalResult> {
    if (actor.role === "VIEWER") {
      throw new Error(APPROVAL_FORBIDDEN);
    }

    const idempotencyRecordKey = idempotencyMapKey(actor.tenantId, idempotencyKey);
    const existing = this.#approvalIdempotency.get(idempotencyRecordKey);
    if (existing) {
      if (existing.normalizedCommand !== normalizedCommand) {
        throw new Error(APPROVAL_IDEMPOTENCY_CONFLICT);
      }
      return clone(existing.result);
    }

    const stored = this.#requireRequest(actor, command.requestId);
    if (stored.request.state !== "REVIEW") {
      this.#recordApprovalRejection(actor, stored.request, "INVALID_TRANSITION");
      throw new Error(INVALID_TRANSITION);
    }

    if (!isCurrentSafeProposal(stored, command)) {
      this.#recordApprovalRejection(
        actor,
        stored.request,
        "STALE_OR_UNSAFE_PROPOSAL"
      );
      throw new Error(STALE_OR_UNSAFE_PROPOSAL);
    }

    const proposal = stored.evaluation.proposal;
    if (!proposal) {
      throw new Error(STALE_OR_UNSAFE_PROPOSAL);
    }
    const approvalId = this.#stageEntityId("approval", this.#approvalIds);
    const assignmentId = this.#stageEntityId("assignment", this.#assignmentIds);
    const approvalCreatedAt = this.#timestamp();
    const assignmentCreatedAt = this.#timestamp();
    const approval: AssignmentApproval = {
      id: approvalId,
      tenantId: actor.tenantId,
      requestId: stored.request.id,
      requestRevision: command.requestRevision,
      technicianId: proposal.technicianId,
      approvedBy: actor.actorId,
      approvedByRole: actor.role,
      reason: command.reason,
      createdAt: approvalCreatedAt
    };
    const assignment: Assignment = {
      id: assignmentId,
      tenantId: actor.tenantId,
      requestId: stored.request.id,
      technicianId: proposal.technicianId,
      approvalId,
      assignedBy: actor.actorId,
      createdAt: assignmentCreatedAt
    };
    const updatedRequest: ServiceRequest = {
      ...stored.request,
      state: "ASSIGNED",
      revision: stored.request.revision + 1,
      ownerId: actor.actorId,
      assigneeId: proposal.technicianId,
      assignmentId,
      updatedAt: assignmentCreatedAt
    };
    const result: ApproveProposalResult = {
      request: clone(updatedRequest),
      approval: clone(approval),
      assignment: clone(assignment),
      outboundActionCount: 0
    };

    const nextSequence = (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1;
    const stagedEventIds = new Set<string>();
    const approvalEvent = this.#stageAuditEvent(
      actor,
      stored.request.id,
      "PROPOSAL_APPROVED",
      {
        fromState: "REVIEW",
        toState: "APPROVED",
        approvalId,
        technicianId: proposal.technicianId,
        reason: command.reason,
        requestRevision: command.requestRevision
      },
      nextSequence,
      stagedEventIds
    );
    const assignmentEvent = this.#stageAuditEvent(
      actor,
      stored.request.id,
      "ASSIGNMENT_CREATED",
      {
        fromState: "APPROVED",
        toState: "ASSIGNED",
        assignmentId,
        approvalId,
        technicianId: proposal.technicianId
      },
      nextSequence + 1,
      stagedEventIds
    );

    this.#requests.set(requestMapKey(actor.tenantId, stored.request.id), {
      request: clone(updatedRequest),
      evaluation: clone(stored.evaluation)
    });
    this.#approvals.set(requestMapKey(actor.tenantId, approvalId), clone(approval));
    this.#assignments.set(requestMapKey(actor.tenantId, assignmentId), clone(assignment));
    this.#approvalIdempotency.set(idempotencyRecordKey, {
      normalizedCommand,
      result: clone(result)
    });
    this.#audit.push(approvalEvent, assignmentEvent);
    this.#tenantSequence.set(actor.tenantId, assignmentEvent.sequence);
    this.#auditEventIds.add(approvalEvent.id);
    this.#auditEventIds.add(assignmentEvent.id);
    this.#approvalIds.add(approvalId);
    this.#assignmentIds.add(assignmentId);
    return clone(result);
  }

  async executeLifecycleTransition(
    actor: ServiceFlowMutationActor,
    action: LifecycleAction,
    command: LifecycleCommand,
    idempotencyKey: string,
    normalizedCommand: string
  ): Promise<LifecycleCommandResult> {
    if (actor.role === "VIEWER") {
      throw new Error(LIFECYCLE_FORBIDDEN);
    }

    const recordKey = lifecycleIdempotencyMapKey(actor.tenantId, action, idempotencyKey);
    const replay = this.#replayLifecycle<LifecycleCommandResult>(recordKey, normalizedCommand);
    if (replay) return replay;

    const stored = this.#requireRequest(actor, command.requestId);
    if (stored.request.revision !== command.requestRevision) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "STALE_REQUEST_REVISION",
        STALE_REQUEST_REVISION,
        recordKey,
        normalizedCommand
      );
    }

    if (
      action === "RESUME" &&
      stored.request.state === "BLOCKED" &&
      (stored.evaluation.blockReason === "POSSIBLE_EMERGENCY" ||
        stored.evaluation.blockReason === "SAFETY_UNKNOWN")
    ) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "SAFETY_BLOCK_CANNOT_RESUME",
        SAFETY_BLOCK_CANNOT_RESUME,
        recordKey,
        normalizedCommand
      );
    }

    const expectedState = lifecycleExpectedState(action);
    if (stored.request.state !== expectedState || !lifecycleInvariantHolds(action, stored.request)) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "INVALID_TRANSITION",
        INVALID_TRANSITION,
        recordKey,
        normalizedCommand
      );
    }

    if (action === "COMPLETE" && !this.#hasStoredEvidence(stored.request)) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "MISSING_COMPLETION_EVIDENCE",
        COMPLETION_EVIDENCE_REQUIRED,
        recordKey,
        normalizedCommand
      );
    }
    if (action === "CLOSE" && !this.#hasStoredEvidence(stored.request)) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "MISSING_COMPLETION_EVIDENCE",
        COMPLETION_EVIDENCE_REQUIRED,
        recordKey,
        normalizedCommand
      );
    }

    const toState = lifecycleTargetState(action);
    const updatedRequest: ServiceRequest = {
      ...stored.request,
      state: toState,
      revision: stored.request.revision + 1,
      operationalBlockReason:
        action === "BLOCK"
          ? command.reason
          : action === "RESUME"
            ? null
            : stored.request.operationalBlockReason,
      updatedAt: this.#timestamp()
    };
    const result: LifecycleCommandResult = {
      request: clone(updatedRequest),
      outboundActionCount: 0
    };
    const event = this.#stageAuditEvent(
      actor,
      stored.request.id,
      lifecycleEventType(action),
      {
        fromState: stored.request.state,
        toState,
        reason: command.reason,
        requestRevision: command.requestRevision
      },
      (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1,
      new Set<string>()
    );

    this.#requests.set(requestMapKey(actor.tenantId, stored.request.id), {
      request: clone(updatedRequest),
      evaluation: clone(stored.evaluation)
    });
    this.#lifecycleIdempotency.set(recordKey, {
      normalizedCommand,
      result: clone(result)
    });
    this.#audit.push(event);
    this.#tenantSequence.set(actor.tenantId, event.sequence);
    this.#auditEventIds.add(event.id);
    return clone(result);
  }

  async attachCompletionEvidence(
    actor: ServiceFlowMutationActor,
    command: AttachCompletionEvidenceCommand,
    idempotencyKey: string,
    normalizedCommand: string
  ): Promise<AttachCompletionEvidenceResult> {
    if (actor.role === "VIEWER") {
      throw new Error(LIFECYCLE_FORBIDDEN);
    }

    const action = "ATTACH_EVIDENCE";
    const recordKey = lifecycleIdempotencyMapKey(actor.tenantId, action, idempotencyKey);
    const replay = this.#replayLifecycle<AttachCompletionEvidenceResult>(
      recordKey,
      normalizedCommand
    );
    if (replay) return replay;

    const stored = this.#requireRequest(actor, command.requestId);
    if (stored.request.revision !== command.requestRevision) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "STALE_REQUEST_REVISION",
        STALE_REQUEST_REVISION,
        recordKey,
        normalizedCommand
      );
    }
    if (stored.request.state !== "IN_PROGRESS" || !stored.request.assignmentId) {
      this.#rejectLifecycle(
        actor,
        action,
        stored.request,
        "INVALID_TRANSITION",
        INVALID_TRANSITION,
        recordKey,
        normalizedCommand
      );
    }

    const evidenceId = this.#stageEntityId("completion evidence", this.#completionEvidenceIds);
    const createdAt = this.#timestamp();
    const evidence: CompletionEvidence = {
      id: evidenceId,
      tenantId: actor.tenantId,
      requestId: stored.request.id,
      assignmentId: stored.request.assignmentId,
      type: command.evidenceType,
      assetId: command.evidenceAssetId,
      attachedBy: actor.actorId,
      createdAt
    };
    const updatedRequest: ServiceRequest = {
      ...stored.request,
      revision: stored.request.revision + 1,
      completionEvidenceIds: [...stored.request.completionEvidenceIds, evidenceId],
      updatedAt: createdAt
    };
    const result: AttachCompletionEvidenceResult = {
      request: clone(updatedRequest),
      evidence: clone(evidence),
      outboundActionCount: 0
    };
    const event = this.#stageAuditEvent(
      actor,
      stored.request.id,
      "COMPLETION_EVIDENCE_ATTACHED",
      {
        fromState: "IN_PROGRESS",
        toState: "IN_PROGRESS",
        evidenceId,
        evidenceType: evidence.type,
        evidenceAssetId: evidence.assetId,
        requestRevision: command.requestRevision
      },
      (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1,
      new Set<string>()
    );

    this.#requests.set(requestMapKey(actor.tenantId, stored.request.id), {
      request: clone(updatedRequest),
      evaluation: clone(stored.evaluation)
    });
    this.#completionEvidence.set(requestMapKey(actor.tenantId, evidence.id), clone(evidence));
    this.#lifecycleIdempotency.set(recordKey, {
      normalizedCommand,
      result: clone(result)
    });
    this.#audit.push(event);
    this.#tenantSequence.set(actor.tenantId, event.sequence);
    this.#auditEventIds.add(event.id);
    this.#completionEvidenceIds.add(evidence.id);
    return clone(result);
  }

  async replaceEvaluation(
    actor: ServiceFlowActor,
    requestId: string,
    evaluation: RequestEvaluation,
    state: ServiceRequest["state"]
  ): Promise<CreateServiceRequestResult> {
    const stored = this.#requireRequest(actor, requestId);
    if (
      stored.request.assignmentId !== null ||
      stored.request.state === "APPROVED" ||
      stored.request.state === "IN_PROGRESS" ||
      stored.request.state === "COMPLETED" ||
      stored.request.state === "CLOSED"
    ) {
      throw new Error(INVALID_TRANSITION);
    }
    const updatedRequest: ServiceRequest = {
      ...stored.request,
      state,
      revision: stored.request.revision + 1,
      updatedAt: this.#timestamp()
    };
    const stagedRequest: StoredRequest = {
      request: clone(updatedRequest),
      evaluation: clone(evaluation)
    };
    const stagedResult: CreateServiceRequestResult = {
      request: clone(updatedRequest),
      evaluation: clone(evaluation),
      outboundActionCount: 0
    };
    const stagedEvent = this.#stageAuditEvent(
      actor,
      requestId,
      "REQUEST_REEVALUATED",
      evaluationDetails(stored.request.state, state, evaluation),
      (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1,
      new Set<string>()
    );
    this.#requests.set(requestMapKey(actor.tenantId, requestId), stagedRequest);
    this.#audit.push(stagedEvent);
    this.#tenantSequence.set(actor.tenantId, stagedEvent.sequence);
    this.#auditEventIds.add(stagedEvent.id);
    return clone(stagedResult);
  }

  #replayLifecycle<T extends LifecycleStoredResult>(
    recordKey: string,
    normalizedCommand: string
  ): T | null {
    const existing = this.#lifecycleIdempotency.get(recordKey);
    if (!existing) return null;
    if (existing.normalizedCommand !== normalizedCommand) {
      throw new Error(LIFECYCLE_IDEMPOTENCY_CONFLICT);
    }
    if (existing.errorMessage) {
      throw new Error(existing.errorMessage);
    }
    if (!existing.result) {
      throw new Error("Invalid ServiceFlow lifecycle idempotency record");
    }
    return clone(existing.result) as T;
  }

  #rejectLifecycle(
    actor: ServiceFlowMutationActor,
    action: LifecycleAction | "ATTACH_EVIDENCE",
    request: ServiceRequest,
    reasonCode:
      | "INVALID_TRANSITION"
      | "STALE_REQUEST_REVISION"
      | "SAFETY_BLOCK_CANNOT_RESUME"
      | "MISSING_COMPLETION_EVIDENCE",
    errorMessage: string,
    recordKey: string,
    normalizedCommand: string
  ): never {
    const event = this.#stageAuditEvent(
      actor,
      request.id,
      "LIFECYCLE_COMMAND_REJECTED",
      {
        action,
        fromState: request.state,
        toState: request.state,
        reasonCode
      },
      (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1,
      new Set<string>()
    );
    this.#lifecycleIdempotency.set(recordKey, { normalizedCommand, errorMessage });
    this.#audit.push(event);
    this.#tenantSequence.set(actor.tenantId, event.sequence);
    this.#auditEventIds.add(event.id);
    throw new Error(errorMessage);
  }

  #hasStoredEvidence(request: ServiceRequest): boolean {
    return request.completionEvidenceIds.some((evidenceId) =>
      this.#completionEvidence.has(requestMapKey(request.tenantId, evidenceId))
    );
  }

  #clearTenantState(tenantId: string): void {
    const prefix = `${tenantId}\u0000`;
    deleteMapEntriesWithPrefix(this.#requests, prefix);
    deleteMapEntriesWithPrefix(this.#idempotency, prefix);
    deleteMapEntriesWithPrefix(this.#approvalIdempotency, prefix);
    deleteMapEntriesWithPrefix(this.#lifecycleIdempotency, prefix);

    for (const [key, approval] of this.#approvals) {
      if (!key.startsWith(prefix)) continue;
      this.#approvals.delete(key);
      this.#approvalIds.delete(approval.id);
    }
    for (const [key, assignment] of this.#assignments) {
      if (!key.startsWith(prefix)) continue;
      this.#assignments.delete(key);
      this.#assignmentIds.delete(assignment.id);
    }
    for (const [key, evidence] of this.#completionEvidence) {
      if (!key.startsWith(prefix)) continue;
      this.#completionEvidence.delete(key);
      this.#completionEvidenceIds.delete(evidence.id);
    }

    const retainedEvents = this.#audit.filter((event) => event.tenantId !== tenantId);
    for (const event of this.#audit) {
      if (event.tenantId === tenantId) this.#auditEventIds.delete(event.id);
    }
    this.#audit.splice(0, this.#audit.length, ...retainedEvents);
    this.#tenantSequence.delete(tenantId);
  }

  #recordApprovalRejection(
    actor: ApprovalActor,
    request: ServiceRequest,
    reasonCode: "INVALID_TRANSITION" | "STALE_OR_UNSAFE_PROPOSAL"
  ): void {
    const event = this.#stageAuditEvent(
      actor,
      request.id,
      "APPROVAL_REJECTED",
      {
        fromState: request.state,
        toState: request.state,
        reasonCode
      },
      (this.#tenantSequence.get(actor.tenantId) ?? 0) + 1,
      new Set<string>()
    );
    this.#audit.push(event);
    this.#tenantSequence.set(actor.tenantId, event.sequence);
    this.#auditEventIds.add(event.id);
  }

  #stageEntityId(
    kind: "approval" | "assignment" | "completion evidence",
    usedIds: Set<string>
  ): string {
    let rawId: string;
    try {
      rawId = this.#id();
    } catch {
      throw new Error(`ServiceFlow ${kind} id generation failed`);
    }
    const parsedId = generatedRequestIdSchema.safeParse(rawId);
    if (!parsedId.success) {
      throw new Error(`Invalid generated ServiceFlow ${kind} id`);
    }
    if (usedIds.has(parsedId.data)) {
      throw new Error(`ServiceFlow ${kind} id collision`);
    }
    return parsedId.data;
  }

  #requireRequest(actor: ServiceFlowActor, requestId: string): StoredRequest {
    const stored = this.#requests.get(requestMapKey(actor.tenantId, requestId));
    if (!stored) {
      throw new Error(SERVICE_REQUEST_NOT_FOUND);
    }
    return stored;
  }

  #stageAuditEvent(
    actor: ServiceFlowActor,
    requestId: string,
    type: ServiceFlowEvent["type"],
    details: Record<string, unknown>,
    sequence: number,
    stagedEventIds: Set<string>
  ): ServiceFlowEvent {
    let rawEventId: string;
    try {
      rawEventId = this.#id();
    } catch {
      throw new Error("ServiceFlow audit event generation failed");
    }
    const parsedEventId = generatedRequestIdSchema.safeParse(rawEventId);
    if (!parsedEventId.success) {
      throw new Error("Invalid generated serviceflow audit event id");
    }
    const eventId = parsedEventId.data;
    if (this.#auditEventIds.has(eventId) || stagedEventIds.has(eventId)) {
      throw new Error("ServiceFlow audit event id collision");
    }
    stagedEventIds.add(eventId);
    return {
      id: eventId,
      tenantId: actor.tenantId,
      sequence,
      requestId,
      type,
      actorId: actor.actorId,
      details: clone(details),
      createdAt: this.#timestamp()
    };
  }

  #timestamp(): string {
    return this.#now().toISOString();
  }
}

function idempotencyMapKey(tenantId: string, idempotencyKey: string): string {
  return `${tenantId}\u0000${idempotencyKey}`;
}

function lifecycleIdempotencyMapKey(
  tenantId: string,
  action: LifecycleAction | "ATTACH_EVIDENCE",
  idempotencyKey: string
): string {
  return `${tenantId}\u0000${action}\u0000${idempotencyKey}`;
}

function requestMapKey(tenantId: string, requestId: string): string {
  return `${tenantId}\u0000${requestId}`;
}

function lifecycleExpectedState(action: LifecycleAction): ServiceRequest["state"] {
  switch (action) {
    case "START":
      return "ASSIGNED";
    case "BLOCK":
    case "COMPLETE":
      return "IN_PROGRESS";
    case "RESUME":
      return "BLOCKED";
    case "CLOSE":
      return "COMPLETED";
  }
}

function lifecycleTargetState(action: LifecycleAction): ServiceRequest["state"] {
  switch (action) {
    case "START":
    case "RESUME":
      return "IN_PROGRESS";
    case "BLOCK":
      return "BLOCKED";
    case "COMPLETE":
      return "COMPLETED";
    case "CLOSE":
      return "CLOSED";
  }
}

function lifecycleEventType(action: LifecycleAction): ServiceFlowEvent["type"] {
  switch (action) {
    case "START":
      return "REQUEST_STARTED";
    case "BLOCK":
      return "REQUEST_BLOCKED";
    case "RESUME":
      return "REQUEST_RESUMED";
    case "COMPLETE":
      return "REQUEST_COMPLETED";
    case "CLOSE":
      return "REQUEST_CLOSED";
  }
}

function lifecycleInvariantHolds(action: LifecycleAction, request: ServiceRequest): boolean {
  if (action === "START") return request.assignmentId !== null;
  if (action === "RESUME") {
    return request.assignmentId !== null && request.operationalBlockReason !== null;
  }
  if (action === "BLOCK" || action === "COMPLETE" || action === "CLOSE") {
    return request.assignmentId !== null;
  }
  return false;
}

function isCurrentSafeProposal(
  stored: StoredRequest,
  command: ApproveProposalCommand
): boolean {
  const proposal = stored.evaluation.proposal;
  return (
    stored.request.revision === command.requestRevision &&
    stored.evaluation.blockReason === null &&
    Object.values(stored.evaluation.checks).every((check) => check === "PASS") &&
    proposal !== null &&
    proposal.technicianId === command.technicianId &&
    proposal.policyVersion === command.proposalPolicyVersion &&
    proposal.ruleVersion === command.proposalRuleVersion
  );
}

function evaluationDetails(
  fromState: ServiceRequest["state"],
  state: ServiceRequest["state"],
  evaluation: RequestEvaluation
): Record<string, unknown> {
  return {
    fromState,
    toState: state,
    policyVersion: evaluation.policyVersion,
    checks: clone(evaluation.checks),
    blockReason: evaluation.blockReason,
    missingFields: evaluation.missingFields,
    hasProposal: evaluation.proposal !== null
  };
}

function assertDeterministicResetPlan(cases: readonly DemoResetCasePlan[]): void {
  const standard = cases[0];
  const safety = cases[1];
  if (
    cases.length !== 2 ||
    standard?.key !== "STANDARD" ||
    standard.state !== "REVIEW" ||
    standard.input.synthetic !== true ||
    standard.evaluation.blockReason !== null ||
    standard.evaluation.proposal === null ||
    safety?.key !== "SAFETY" ||
    safety.state !== "BLOCKED" ||
    safety.input.synthetic !== true ||
    safety.evaluation.blockReason !== "POSSIBLE_EMERGENCY" ||
    safety.evaluation.proposal !== null
  ) {
    throw new Error("Invalid deterministic ServiceFlow demo reset plan");
  }
}

function deterministicDemoId(tenantId: string, suffix: string): string {
  const id = `DEMO_${tenantId}_${suffix}`;
  const parsed = generatedRequestIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new Error("Invalid deterministic ServiceFlow demo id");
  }
  return parsed.data;
}

function deterministicResetTimestamp(offsetSeconds: number): string {
  return new Date(Date.parse("2026-09-05T00:00:00.000Z") + offsetSeconds * 1_000).toISOString();
}

function deleteMapEntriesWithPrefix<T>(map: Map<string, T>, prefix: string): void {
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) map.delete(key);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
