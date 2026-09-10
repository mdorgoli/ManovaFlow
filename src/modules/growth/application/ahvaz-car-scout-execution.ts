import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { ActorContext } from "../domain/types";
import { requireCapability } from "../domain/rbac";
import {
  AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY,
  AHVAZ_CAR_SCOUT_SCOPE,
  AHVAZ_CAR_SCOUT_VERSION,
  ahvazCarScoutSnapshotSchema,
  type AhvazCarScoutExecution,
  type AhvazCarScoutFeed,
  type AhvazCarScoutSnapshot,
  type AhvazCarScoutSource
} from "./ahvaz-car-scout-contracts";
import { runAhvazCarScoutWorker } from "./ahvaz-car-scout-worker";

const actorSchema = z.strictObject({ tenantId: z.uuid(), actorId: z.uuid(), role: z.enum(["OWNER", "OPERATOR", "VIEWER"]) });
const MAX_TENANT_RUNS = 32;

type RunRecord = { tenantId: string; snapshot: AhvazCarScoutSnapshot; operation: Promise<AhvazCarScoutSnapshot> };
interface LocalRunState { records: Map<string, RunRecord>; active: boolean }

export class AhvazCarScoutAdmissionError extends Error {
  constructor(readonly code: "SCOUT_BUSY" | "SCOUT_CAPACITY_REACHED" | "SCOUT_KEY_INVALID") {
    super(code);
  }
}

/** Local process memory, one immutable attempt per tenant and fixed task key.
 * Records (including failures) survive HMR, not a full process restart.
 * Production is disabled by the route; this is not durable production storage.
 */
export class AhvazCarScoutExecutor {
  constructor(private readonly state: LocalRunState = { records: new Map(), active: false }) {}

  read(actor: ActorContext): AhvazCarScoutFeed {
    actorSchema.parse(actor);
    requireCapability(actor, "VIEW_DASHBOARD");
    const record = this.state.records.get(actor.tenantId);
    if (record && record.tenantId !== actor.tenantId) throw new Error("SCOUT_TENANT_MISMATCH");
    return {
      contractVersion: AHVAZ_CAR_SCOUT_VERSION,
      persistence: "PROCESS_MEMORY",
      snapshot: record ? ahvazCarScoutSnapshotSchema.parse(structuredClone(record.snapshot)) : null
    };
  }

  async execute(input: { actor: ActorContext; idempotencyKey: string; source: AhvazCarScoutSource }): Promise<AhvazCarScoutExecution> {
    actorSchema.parse(input.actor);
    requireCapability(input.actor, "RUN_RESEARCH");
    if (input.idempotencyKey !== AHVAZ_CAR_SCOUT_IDEMPOTENCY_KEY) throw new AhvazCarScoutAdmissionError("SCOUT_KEY_INVALID");
    const tenantId = input.actor.tenantId;
    const existing = this.state.records.get(tenantId);
    if (existing) {
      if (existing.tenantId !== tenantId) throw new Error("SCOUT_TENANT_MISMATCH");
      return execution("REUSED", await existing.operation);
    }
    if (this.state.active) throw new AhvazCarScoutAdmissionError("SCOUT_BUSY");
    if (this.state.records.size >= MAX_TENANT_RUNS) throw new AhvazCarScoutAdmissionError("SCOUT_CAPACITY_REACHED");
    this.state.active = true;
    const initial: AhvazCarScoutSnapshot = {
      runId: randomUUID(), scope: AHVAZ_CAR_SCOUT_SCOPE, agent: "market-scout",
      mode: "PUBLIC_DATA_RESEARCH_ONLY", status: "RUNNING", startedAt: new Date().toISOString(),
      finishedAt: null, requestCount: 0, sourceHttpStatus: null, paidSpend: 0, failureCode: null, discovery: null
    };
    // Defer the worker until the record exists, making same-turn admission atomic.
    const operation = Promise.resolve().then(() => runAhvazCarScoutWorker({
      initial,
      source: input.source,
      onRequest: (requestCount) => { record.snapshot = { ...record.snapshot, requestCount }; },
      onResponse: (sourceHttpStatus) => { record.snapshot = { ...record.snapshot, sourceHttpStatus }; }
    })).then((snapshot) => {
      record.snapshot = snapshot;
      return snapshot;
    }).finally(() => { this.state.active = false; });
    const record: RunRecord = { tenantId, snapshot: initial, operation };
    this.state.records.set(tenantId, record);
    return execution("CREATED", await operation);
  }
}

function execution(disposition: AhvazCarScoutExecution["disposition"], snapshot: AhvazCarScoutSnapshot): AhvazCarScoutExecution {
  return { contractVersion: AHVAZ_CAR_SCOUT_VERSION, disposition, snapshot: ahvazCarScoutSnapshotSchema.parse(structuredClone(snapshot)) };
}

const shared = globalThis as typeof globalThis & { manovaFlowAhvazCarScoutStateV1?: LocalRunState };
export function getAhvazCarScoutExecutor(): AhvazCarScoutExecutor {
  // Share data/locks across HMR, not an instance holding stale compiled methods.
  const state = shared.manovaFlowAhvazCarScoutStateV1 ??= { records: new Map(), active: false };
  return new AhvazCarScoutExecutor(state);
}
