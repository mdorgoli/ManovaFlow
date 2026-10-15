export const REQUEST_STATES = [
  "NEW",
  "NEEDS_INFO",
  "REVIEW",
  "BLOCKED",
  "APPROVED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED"
] as const;
export type ServiceRequestState = (typeof REQUEST_STATES)[number];

export const BLOCK_REASONS = [
  "OUT_OF_SCOPE_SERVICE",
  "OUT_OF_SERVICE_AREA",
  "OUTSIDE_SUPPORTED_HOURS",
  "POSSIBLE_EMERGENCY",
  "SAFETY_UNKNOWN",
  "NO_ELIGIBLE_ASSIGNEE"
] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export type PolicyCheckStatus = "PASS" | "FAIL" | "NOT_EVALUATED";

export type ServiceFlowRole = "OWNER" | "OPERATOR" | "VIEWER";

export interface ServiceFlowActor {
  tenantId: string;
  actorId: string;
  role?: ServiceFlowRole | undefined;
}

export interface ApprovalActor extends ServiceFlowActor {
  role: ServiceFlowRole;
}

export interface ServiceFlowMutationActor extends ServiceFlowActor {
  role: ServiceFlowRole;
}

export interface ServiceRequestInput {
  synthetic: true;
  description?: string | undefined;
  address?: string | undefined;
  service?: string | undefined;
  requestedHour: number;
  safetyAssessment: "SAFE" | "UNKNOWN";
}

export interface Technician {
  id: string;
  label: string;
  synthetic: true;
  status: "ACTIVE" | "INACTIVE";
  skills: readonly string[];
  serviceAreas: readonly string[];
  availableHours: readonly number[];
}

export interface AssignmentProposal {
  technicianId: string;
  technicianLabel: string;
  requestedHour: number;
  policyVersion: string;
  ruleVersion: string;
  explanation: string;
}

export interface PolicyChecks {
  completeness: PolicyCheckStatus;
  service: PolicyCheckStatus;
  serviceArea: PolicyCheckStatus;
  supportedHours: PolicyCheckStatus;
  safety: PolicyCheckStatus;
}

export interface RequestEvaluation {
  policyVersion: string;
  checks: PolicyChecks;
  missingFields: readonly ("description" | "address" | "service")[];
  blockReason: BlockReason | null;
  proposal: AssignmentProposal | null;
}

export interface ServiceRequest {
  id: string;
  tenantId: string;
  state: ServiceRequestState;
  revision: number;
  input: ServiceRequestInput;
  ownerId: string | null;
  assigneeId: string | null;
  assignmentId: string | null;
  operationalBlockReason: string | null;
  completionEvidenceIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApproveProposalCommand {
  requestId: string;
  requestRevision: number;
  technicianId: string;
  proposalPolicyVersion: string;
  proposalRuleVersion: string;
  reason: string;
}

export interface AssignmentApproval {
  id: string;
  tenantId: string;
  requestId: string;
  requestRevision: number;
  technicianId: string;
  approvedBy: string;
  approvedByRole: Exclude<ServiceFlowRole, "VIEWER">;
  reason: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  tenantId: string;
  requestId: string;
  technicianId: string;
  approvalId: string;
  assignedBy: string;
  createdAt: string;
}

export interface ServiceFlowEvent {
  id: string;
  tenantId: string;
  sequence: number;
  requestId: string;
  type:
    | "REQUEST_CREATED"
    | "REQUEST_EVALUATED"
    | "REQUEST_REEVALUATED"
    | "PROPOSAL_APPROVED"
    | "ASSIGNMENT_CREATED"
    | "APPROVAL_REJECTED"
    | "REQUEST_STARTED"
    | "REQUEST_BLOCKED"
    | "REQUEST_RESUMED"
    | "COMPLETION_EVIDENCE_ATTACHED"
    | "REQUEST_COMPLETED"
    | "REQUEST_CLOSED"
    | "LIFECYCLE_COMMAND_REJECTED"
    | "DEMO_TENANT_RESET";
  actorId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CreateServiceRequestResult {
  request: ServiceRequest;
  evaluation: RequestEvaluation;
  outboundActionCount: 0;
}

export interface ApproveProposalResult {
  request: ServiceRequest;
  approval: AssignmentApproval;
  assignment: Assignment;
  outboundActionCount: 0;
}

export type LifecycleAction =
  "START" | "BLOCK" | "RESUME" | "COMPLETE" | "CLOSE";

export interface LifecycleCommand {
  requestId: string;
  requestRevision: number;
  reason: string;
}

export const DEMO_EVIDENCE_ASSET_IDS = [
  "DEMO_EVIDENCE_FIXTURE_COMPLETION_01",
  "DEMO_EVIDENCE_FIXTURE_COMPLETION_02"
] as const;
export type DemoEvidenceAssetId = (typeof DEMO_EVIDENCE_ASSET_IDS)[number];
export type CompletionEvidenceType = "DEMO_INTERNAL_FIXTURE";

export interface AttachCompletionEvidenceCommand {
  requestId: string;
  requestRevision: number;
  evidenceType: CompletionEvidenceType;
  evidenceAssetId: DemoEvidenceAssetId;
}

export interface CompletionEvidence {
  id: string;
  tenantId: string;
  requestId: string;
  assignmentId: string;
  type: CompletionEvidenceType;
  assetId: DemoEvidenceAssetId;
  attachedBy: string;
  createdAt: string;
}

export interface LifecycleCommandResult {
  request: ServiceRequest;
  outboundActionCount: 0;
}

export interface AttachCompletionEvidenceResult extends LifecycleCommandResult {
  evidence: CompletionEvidence;
}

export interface ServiceFlowCase {
  request: ServiceRequest;
  evaluation: RequestEvaluation;
}

export interface ServiceFlowSnapshot {
  cases: ServiceFlowCase[];
  approvals: AssignmentApproval[];
  assignments: Assignment[];
  completionEvidence: CompletionEvidence[];
  audit: ServiceFlowEvent[];
  outboundActionCount: 0;
}

export interface DemoResetCasePlan {
  key: "STANDARD" | "SAFETY";
  input: ServiceRequestInput;
  evaluation: RequestEvaluation;
  state: ServiceRequestState;
}
