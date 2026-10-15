import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { authorizeResearchRun } from "@/lib/api-policy";
import { getGrowthRepository } from "@/lib/container";
import { resolveRequestActor } from "@/lib/request-auth";
import { runAllLanes } from "@/modules/growth/application/run-parallel";
import { candidateSchema } from "@/modules/growth/domain/candidate-schema";
import { syntheticFixtures } from "@/modules/growth/demo/fixtures";

const inputsByLaneSchema = z
  .strictObject({
    serviceflow: z.array(candidateSchema).max(40),
    beautyflow: z.array(candidateSchema).max(25),
    briefflow: z.array(candidateSchema).max(25)
  })
  .superRefine((lanes, context) => {
    for (const [laneKey, candidates] of Object.entries(lanes)) {
      candidates.forEach((candidate, index) => {
        if (candidate.laneKey !== laneKey) {
          context.addIssue({
            code: "custom",
            path: [laneKey, index, "laneKey"],
            message: "Candidate lane must match its input bucket"
          });
        }
      });
    }
  });

const researchPayloadSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("SYNTHETIC") }),
  z.strictObject({
    mode: z.literal("MANUAL"),
    inputsByLane: inputsByLaneSchema
  })
]);

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const actor = await resolveRequestActor(request);
    const batchKey = authorizeResearchRun(actor, request.headers);
    const payload = researchPayloadSchema.parse(await request.json());
    const inputsByLane =
      payload.mode === "SYNTHETIC" ? syntheticFixtures : payload.inputsByLane;
    const result = await runAllLanes({
      actor,
      batchKey,
      inputsByLane,
      repository: getGrowthRepository()
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
