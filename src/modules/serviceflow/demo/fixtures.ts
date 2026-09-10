import type { ServiceRequestInput } from "../domain/types";

export const SERVICEFLOW_DEMO_RESET_INPUTS: Readonly<
  Record<"STANDARD" | "SAFETY", ServiceRequestInput>
> = Object.freeze({
  STANDARD: Object.freeze({
    synthetic: true,
    description: "DEMO: kitchen sink has a slow leak and no safety concerns.",
    address: "DEMO_CENTRAL_ZONE",
    service: "PLUMBING_LEAK",
    requestedHour: 10,
    safetyAssessment: "SAFE"
  }),
  SAFETY: Object.freeze({
    synthetic: true,
    description: "DEMO: there is a gas leak and an immediate hazard.",
    address: "DEMO_CENTRAL_ZONE",
    service: "PLUMBING_LEAK",
    requestedHour: 10,
    safetyAssessment: "SAFE"
  })
});
