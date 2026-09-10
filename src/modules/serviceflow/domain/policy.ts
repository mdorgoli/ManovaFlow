import type {
  AssignmentProposal,
  RequestEvaluation,
  ServiceRequestInput,
  ServiceRequestState,
  Technician
} from "./types";

export const SERVICEFLOW_POLICY_VERSION = "serviceflow-policy-v1";
export const ASSIGNEE_PROPOSAL_RULE_VERSION = "assignee-proposal-v1";

const SUPPORTED_SERVICES = new Set(["PLUMBING_LEAK", "ELECTRICAL_REPAIR"]);
const SUPPORTED_AREAS = new Set(["DEMO_CENTRAL_ZONE", "DEMO_NORTH_ZONE"]);
const SUPPORTED_HOURS = new Set([9, 10, 11, 12, 13, 14, 15, 16]);
const HAZARD_PATTERN = /(?:\b(emergency|fire|smoke|gas\s+(?:leak|odor|smell)|hazard|explosion|electrocution|electric\s+shock|live\s+wire|spark(?:ing)?|burning\s+smell|structural\s+collapse|uncontrolled\s+flooding)\b|اضطرار(?:ی)?|آتش|دود|نشت\s*گاز|بوی\s*گاز|جرقه|سیم\s*لخت|بوی\s*سوختگی|برق\s*گرفتگی|فروریزش|سیل\s*کنترل\s*نشده|خطر)/i;
const AMBIGUOUS_SAFETY_PATTERN = /(?:\b(not\s+sure|unknown\s+whether\s+safe|possibly\s+unsafe|strange\s+smell)\b|مطمئن\s*نیستم|نامشخص|احتمالاً?\s*ناامن|بوی\s*عجیب)/i;

export const DEFAULT_DEMO_TECHNICIANS: readonly Technician[] = [
  {
    id: "DEMO_TECHNICIAN_ALPHA",
    label: "DEMO TECHNICIAN ALPHA — SYNTHETIC",
    synthetic: true,
    status: "ACTIVE",
    skills: ["PLUMBING_LEAK", "ELECTRICAL_REPAIR"],
    serviceAreas: ["DEMO_CENTRAL_ZONE"],
    availableHours: [9, 10, 11, 12, 13, 14, 15, 16]
  },
  {
    id: "DEMO_TECHNICIAN_BRAVO",
    label: "DEMO TECHNICIAN BRAVO — SYNTHETIC",
    synthetic: true,
    status: "ACTIVE",
    skills: ["PLUMBING_LEAK"],
    serviceAreas: ["DEMO_NORTH_ZONE"],
    availableHours: [9, 10, 11, 12, 13, 14, 15, 16]
  }
];

export interface EvaluationPlan {
  state: ServiceRequestState;
  evaluation: RequestEvaluation;
}

export function evaluateIntake(
  input: ServiceRequestInput,
  technicians: readonly Technician[]
): EvaluationPlan {
  const mutableChecks: RequestEvaluation["checks"] = {
    completeness: "NOT_EVALUATED",
    service: "NOT_EVALUATED",
    serviceArea: "NOT_EVALUATED",
    supportedHours: "NOT_EVALUATED",
    safety: "NOT_EVALUATED"
  };
  if (input.description && HAZARD_PATTERN.test(input.description)) {
    mutableChecks.safety = "FAIL";
    return plan("BLOCKED", mutableChecks, [], "POSSIBLE_EMERGENCY", null);
  }
  if (input.description && AMBIGUOUS_SAFETY_PATTERN.test(input.description)) {
    mutableChecks.safety = "FAIL";
    return plan("BLOCKED", mutableChecks, [], "SAFETY_UNKNOWN", null);
  }
  if (input.safetyAssessment !== "SAFE") {
    mutableChecks.safety = "FAIL";
    return plan("BLOCKED", mutableChecks, [], "SAFETY_UNKNOWN", null);
  }
  mutableChecks.safety = "PASS";

  const fieldNames = ["description", "address", "service"] as const;
  const missingFields = fieldNames.filter(
    (field): field is "description" | "address" | "service" => !input[field]
  );

  mutableChecks.completeness = missingFields.length === 0 ? "PASS" : "FAIL";
  if (missingFields.length > 0) {
    return plan("NEEDS_INFO", mutableChecks, missingFields, null, null);
  }

  const { description, address, service } = input;
  if (!description || !address || !service) {
    throw new Error("Complete ServiceFlow intake unexpectedly lost a required field");
  }

  if (!SUPPORTED_SERVICES.has(service)) {
    mutableChecks.service = "FAIL";
    return plan("BLOCKED", mutableChecks, [], "OUT_OF_SCOPE_SERVICE", null);
  }
  mutableChecks.service = "PASS";

  if (!SUPPORTED_AREAS.has(address)) {
    mutableChecks.serviceArea = "FAIL";
    return plan("BLOCKED", mutableChecks, [], "OUT_OF_SERVICE_AREA", null);
  }
  mutableChecks.serviceArea = "PASS";

  if (!SUPPORTED_HOURS.has(input.requestedHour)) {
    mutableChecks.supportedHours = "FAIL";
    return plan("BLOCKED", mutableChecks, [], "OUTSIDE_SUPPORTED_HOURS", null);
  }
  mutableChecks.supportedHours = "PASS";

  const eligible = technicians
    .filter(
      (technician) =>
        technician.synthetic &&
        technician.status === "ACTIVE" &&
        technician.skills.includes(service) &&
        technician.serviceAreas.includes(address) &&
        technician.availableHours.includes(input.requestedHour)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const selected = eligible[0];
  if (!selected) {
    return plan("BLOCKED", mutableChecks, [], "NO_ELIGIBLE_ASSIGNEE", null);
  }

  const proposal: AssignmentProposal = {
    technicianId: selected.id,
    technicianLabel: selected.label,
    requestedHour: input.requestedHour,
    policyVersion: SERVICEFLOW_POLICY_VERSION,
    ruleVersion: ASSIGNEE_PROPOSAL_RULE_VERSION,
    explanation:
      "Synthetic technician is active, has the required skill, serves the DEMO area, and is available at the requested hour. Equal candidates are ordered by technician id."
  };
  return plan("REVIEW", mutableChecks, [], null, proposal);
}

function plan(
  state: ServiceRequestState,
  checks: RequestEvaluation["checks"],
  missingFields: RequestEvaluation["missingFields"],
  blockReason: RequestEvaluation["blockReason"],
  proposal: AssignmentProposal | null
): EvaluationPlan {
  return {
    state,
    evaluation: {
      policyVersion: SERVICEFLOW_POLICY_VERSION,
      checks,
      missingFields,
      blockReason,
      proposal
    }
  };
}
