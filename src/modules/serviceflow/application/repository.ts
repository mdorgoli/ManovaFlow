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

export interface ServiceFlowRepository {
  createOrReuse(
    actor: ServiceFlowActor,
    idempotencyKey: string,
    normalizedPayload: string,
    input: ServiceRequestInput,
    evaluation: RequestEvaluation,
    state: ServiceRequest["state"]
  ): Promise<CreateServiceRequestResult>;
  getRequest(actor: ServiceFlowActor, requestId: string): Promise<ServiceRequest>;
  listRequests(actor: ServiceFlowActor): Promise<ServiceRequest[]>;
  listAudit(actor: ServiceFlowActor): Promise<ServiceFlowEvent[]>;
  getExceptionCount(actor: ServiceFlowActor, reason: BlockReason): Promise<number>;
  replaceEvaluation(
    actor: ServiceFlowActor,
    requestId: string,
    evaluation: RequestEvaluation,
    state: ServiceRequest["state"]
  ): Promise<CreateServiceRequestResult>;
  approveProposal(
    actor: ApprovalActor,
    command: ApproveProposalCommand,
    idempotencyKey: string,
    normalizedCommand: string
  ): Promise<ApproveProposalResult>;
  listApprovals(actor: ServiceFlowActor): Promise<AssignmentApproval[]>;
  listAssignments(actor: ServiceFlowActor): Promise<Assignment[]>;
  executeLifecycleTransition(
    actor: ServiceFlowMutationActor,
    action: LifecycleAction,
    command: LifecycleCommand,
    idempotencyKey: string,
    normalizedCommand: string
  ): Promise<LifecycleCommandResult>;
  attachCompletionEvidence(
    actor: ServiceFlowMutationActor,
    command: AttachCompletionEvidenceCommand,
    idempotencyKey: string,
    normalizedCommand: string
  ): Promise<AttachCompletionEvidenceResult>;
  listCompletionEvidence(actor: ServiceFlowActor): Promise<CompletionEvidence[]>;
  getSnapshot(actor: ServiceFlowActor): Promise<ServiceFlowSnapshot>;
  resetDemoTenant(
    actor: ServiceFlowMutationActor,
    cases: readonly DemoResetCasePlan[]
  ): Promise<ServiceFlowSnapshot>;
}

export const SERVICE_REQUEST_NOT_FOUND = "Service request not found";
export const APPROVAL_FORBIDDEN = "ServiceFlow approval is forbidden";
export const INVALID_TRANSITION = "Invalid ServiceFlow transition";
export const STALE_OR_UNSAFE_PROPOSAL = "Assignment proposal is stale or unsafe";
export const APPROVAL_IDEMPOTENCY_CONFLICT =
  "Approval idempotency key is already bound to a different command";
export const LIFECYCLE_FORBIDDEN = "ServiceFlow lifecycle mutation is forbidden";
export const LIFECYCLE_IDEMPOTENCY_CONFLICT =
  "Lifecycle idempotency key is already bound to a different principal or command";
export const STALE_REQUEST_REVISION = "ServiceFlow request revision is stale";
export const SAFETY_BLOCK_CANNOT_RESUME = "Safety-blocked ServiceFlow request cannot resume";
export const COMPLETION_EVIDENCE_REQUIRED = "Completion evidence is required";
