import {
  APPROVAL_FORBIDDEN,
  LIFECYCLE_FORBIDDEN,
  type ServiceFlowRepository
} from "./repository";
import { evaluateIntake, DEFAULT_DEMO_TECHNICIANS } from "../domain/policy";
import { SERVICEFLOW_DEMO_RESET_INPUTS } from "../demo/fixtures";
import {
  parseIdempotencyKey,
  parseApprovalActor,
  parseApproveProposalCommand,
  parseAttachCompletionEvidenceCommand,
  parseLifecycleCommand,
  parseServiceFlowActor,
  parseServiceFlowMutationActor,
  parseServiceRequestInput,
  parseTechnicianCatalog
} from "../domain/schema";
import type {
  ApprovalActor,
  ApproveProposalCommand,
  ApproveProposalResult,
  AttachCompletionEvidenceCommand,
  AttachCompletionEvidenceResult,
  Assignment,
  AssignmentApproval,
  CreateServiceRequestResult,
  BlockReason,
  CompletionEvidence,
  DemoResetCasePlan,
  LifecycleAction,
  LifecycleCommand,
  LifecycleCommandResult,
  ServiceFlowActor,
  ServiceFlowEvent,
  ServiceFlowMutationActor,
  ServiceFlowSnapshot,
  ServiceRequest,
  ServiceRequestInput,
  Technician
} from "../domain/types";

export class ServiceFlowService {
  readonly #repository: ServiceFlowRepository;
  readonly #technicians: readonly Technician[];

  constructor(
    repository: ServiceFlowRepository,
    options: { technicians?: readonly Technician[] } = {}
  ) {
    this.#repository = repository;
    this.#technicians = structuredClone(
      parseTechnicianCatalog(options.technicians ?? DEFAULT_DEMO_TECHNICIANS)
    );
  }

  async createAndEvaluate(
    actorInput: ServiceFlowActor,
    input: ServiceRequestInput,
    idempotencyKeyInput: string
  ): Promise<CreateServiceRequestResult> {
    const actor = parseServiceFlowActor(actorInput);
    const requestInput = parseServiceRequestInput(input);
    const idempotencyKey = parseIdempotencyKey(idempotencyKeyInput);
    const plan = evaluateIntake(requestInput, this.#technicians);
    return this.#repository.createOrReuse(
      actor,
      idempotencyKey,
      JSON.stringify(requestInput),
      requestInput,
      plan.evaluation,
      plan.state
    );
  }

  getRequest(
    actorInput: ServiceFlowActor,
    requestId: string
  ): Promise<ServiceRequest> {
    return this.#repository.getRequest(
      parseServiceFlowActor(actorInput),
      requestId
    );
  }

  listRequests(actorInput: ServiceFlowActor): Promise<ServiceRequest[]> {
    return this.#repository.listRequests(parseServiceFlowActor(actorInput));
  }

  listAudit(actorInput: ServiceFlowActor): Promise<ServiceFlowEvent[]> {
    return this.#repository.listAudit(parseServiceFlowActor(actorInput));
  }

  getExceptionCount(
    actorInput: ServiceFlowActor,
    reason: BlockReason
  ): Promise<number> {
    return this.#repository.getExceptionCount(
      parseServiceFlowActor(actorInput),
      reason
    );
  }

  async approveProposal(
    actorInput: ApprovalActor,
    commandInput: ApproveProposalCommand,
    idempotencyKeyInput: string
  ): Promise<ApproveProposalResult> {
    const actor = parseApprovalActor(actorInput);
    if (actor.role === "VIEWER") {
      throw new Error(APPROVAL_FORBIDDEN);
    }
    const command = parseApproveProposalCommand(commandInput);
    const idempotencyKey = parseIdempotencyKey(idempotencyKeyInput);
    return this.#repository.approveProposal(
      actor,
      command,
      idempotencyKey,
      JSON.stringify({
        actorId: actor.actorId,
        role: actor.role,
        command
      })
    );
  }

  listApprovals(actorInput: ServiceFlowActor): Promise<AssignmentApproval[]> {
    return this.#repository.listApprovals(parseServiceFlowActor(actorInput));
  }

  listAssignments(actorInput: ServiceFlowActor): Promise<Assignment[]> {
    return this.#repository.listAssignments(parseServiceFlowActor(actorInput));
  }

  startRequest(
    actorInput: ServiceFlowMutationActor,
    commandInput: LifecycleCommand,
    idempotencyKeyInput: string
  ): Promise<LifecycleCommandResult> {
    return this.#executeLifecycle(
      "START",
      actorInput,
      commandInput,
      idempotencyKeyInput
    );
  }

  blockRequest(
    actorInput: ServiceFlowMutationActor,
    commandInput: LifecycleCommand,
    idempotencyKeyInput: string
  ): Promise<LifecycleCommandResult> {
    return this.#executeLifecycle(
      "BLOCK",
      actorInput,
      commandInput,
      idempotencyKeyInput
    );
  }

  resumeRequest(
    actorInput: ServiceFlowMutationActor,
    commandInput: LifecycleCommand,
    idempotencyKeyInput: string
  ): Promise<LifecycleCommandResult> {
    return this.#executeLifecycle(
      "RESUME",
      actorInput,
      commandInput,
      idempotencyKeyInput
    );
  }

  completeRequest(
    actorInput: ServiceFlowMutationActor,
    commandInput: LifecycleCommand,
    idempotencyKeyInput: string
  ): Promise<LifecycleCommandResult> {
    return this.#executeLifecycle(
      "COMPLETE",
      actorInput,
      commandInput,
      idempotencyKeyInput
    );
  }

  closeRequest(
    actorInput: ServiceFlowMutationActor,
    commandInput: LifecycleCommand,
    idempotencyKeyInput: string
  ): Promise<LifecycleCommandResult> {
    return this.#executeLifecycle(
      "CLOSE",
      actorInput,
      commandInput,
      idempotencyKeyInput
    );
  }

  async attachCompletionEvidence(
    actorInput: ServiceFlowMutationActor,
    commandInput: AttachCompletionEvidenceCommand,
    idempotencyKeyInput: string
  ): Promise<AttachCompletionEvidenceResult> {
    const actor = this.#parseMutationActor(actorInput);
    const command = parseAttachCompletionEvidenceCommand(commandInput);
    const idempotencyKey = parseIdempotencyKey(idempotencyKeyInput);
    return this.#repository.attachCompletionEvidence(
      actor,
      command,
      idempotencyKey,
      normalizedMutation("ATTACH_EVIDENCE", actor, command)
    );
  }

  listCompletionEvidence(
    actorInput: ServiceFlowActor
  ): Promise<CompletionEvidence[]> {
    return this.#repository.listCompletionEvidence(
      parseServiceFlowActor(actorInput)
    );
  }

  getSnapshot(actorInput: ServiceFlowActor): Promise<ServiceFlowSnapshot> {
    return this.#repository.getSnapshot(parseServiceFlowActor(actorInput));
  }

  async resetDemoTenant(
    actorInput: ServiceFlowMutationActor,
    idempotencyKeyInput: string
  ): Promise<ServiceFlowSnapshot> {
    const actor = this.#parseMutationActor(actorInput);
    parseIdempotencyKey(idempotencyKeyInput);
    const cases = (["STANDARD", "SAFETY"] as const).map(
      (key): DemoResetCasePlan => {
        const input = parseServiceRequestInput(
          SERVICEFLOW_DEMO_RESET_INPUTS[key]
        );
        const evaluation = evaluateIntake(input, this.#technicians);
        return {
          key,
          input,
          evaluation: evaluation.evaluation,
          state: evaluation.state
        };
      }
    );
    return this.#repository.resetDemoTenant(actor, cases);
  }

  async reEvaluate(
    actorInput: ServiceFlowActor,
    requestId: string
  ): Promise<CreateServiceRequestResult> {
    const actor = parseServiceFlowActor(actorInput);
    const request = await this.#repository.getRequest(actor, requestId);
    const plan = evaluateIntake(request.input, this.#technicians);
    return this.#repository.replaceEvaluation(
      actor,
      request.id,
      plan.evaluation,
      plan.state
    );
  }

  async #executeLifecycle(
    action: LifecycleAction,
    actorInput: ServiceFlowMutationActor,
    commandInput: LifecycleCommand,
    idempotencyKeyInput: string
  ): Promise<LifecycleCommandResult> {
    const actor = this.#parseMutationActor(actorInput);
    const command = parseLifecycleCommand(commandInput);
    const idempotencyKey = parseIdempotencyKey(idempotencyKeyInput);
    return this.#repository.executeLifecycleTransition(
      actor,
      action,
      command,
      idempotencyKey,
      normalizedMutation(action, actor, command)
    );
  }

  #parseMutationActor(
    actorInput: ServiceFlowMutationActor
  ): ServiceFlowMutationActor {
    const actor = parseServiceFlowMutationActor(actorInput);
    if (actor.role === "VIEWER") {
      throw new Error(LIFECYCLE_FORBIDDEN);
    }
    return actor;
  }
}

function normalizedMutation(
  action: LifecycleAction | "ATTACH_EVIDENCE",
  actor: ServiceFlowMutationActor,
  command: LifecycleCommand | AttachCompletionEvidenceCommand
): string {
  return JSON.stringify({
    action,
    actorId: actor.actorId,
    role: actor.role,
    command
  });
}
