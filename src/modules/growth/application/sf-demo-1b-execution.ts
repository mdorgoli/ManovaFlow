import type { ActorContext } from "../domain/types";
import type { MarketScoutSource } from "./market-scout-contracts";
import type { MarketScoutWebsiteReviewer } from "./market-scout-website-review";
import type { GrowthRepository } from "./repository";
import {
  parseMarketScoutActivitySnapshot,
  type MarketScoutActivitySnapshotV1
} from "./market-scout-activity";
import { runLiveMarketScoutPilot } from "./live-market-scout-pilot";

export const SF_DEMO_1B_EXECUTION_VERSION =
  "manovaflow.market-scout.execution.v1" as const;
export const SF_DEMO_1B_IDEMPOTENCY_KEY = "sf-demo-1b-live-pilot-v1" as const;
export const SF_DEMO_1B_SCOPE = Object.freeze({
  id: "SF-DEMO-1B" as const,
  countryCode: "FR" as const,
  laneKey: "serviceflow" as const
});

export interface SfDemo1BExecutionInput {
  actor: ActorContext;
  repository: GrowthRepository;
  source: MarketScoutSource;
  websiteReviewer: MarketScoutWebsiteReviewer;
}

export interface SfDemo1BExecutionResult {
  contractVersion: typeof SF_DEMO_1B_EXECUTION_VERSION;
  disposition: "CREATED" | "REUSED";
  scope: typeof SF_DEMO_1B_SCOPE;
  snapshot: MarketScoutActivitySnapshotV1;
}

export class SfDemo1BExecutionError extends Error {
  constructor() {
    super("SF_DEMO_1B_EXECUTION_FAILED");
    this.name = "SfDemo1BExecutionError";
  }
}

export class SfDemo1BExecutor {
  readonly #inFlight = new Map<string, Promise<SfDemo1BExecutionResult>>();

  async execute(
    input: SfDemo1BExecutionInput
  ): Promise<SfDemo1BExecutionResult> {
    const key = input.actor.tenantId;
    const pending = this.#inFlight.get(key);
    if (pending) {
      const result = await pending;
      return { ...result, disposition: "REUSED" };
    }

    const operation = this.#executeOnce(input);
    this.#inFlight.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.#inFlight.get(key) === operation) this.#inFlight.delete(key);
    }
  }

  async #executeOnce(
    input: SfDemo1BExecutionInput
  ): Promise<SfDemo1BExecutionResult> {
    try {
      const dashboard = await input.repository.getDashboard(input.actor);
      if (
        dashboard.runs.some((run) => run.tenantId !== input.actor.tenantId) ||
        dashboard.audit.some((event) => event.tenantId !== input.actor.tenantId)
      ) {
        throw new Error("CROSS_TENANT_REPOSITORY_ROW");
      }

      const existingRun = dashboard.runs.find(
        (run) =>
          run.laneKey === SF_DEMO_1B_SCOPE.laneKey &&
          run.idempotencyKey === SF_DEMO_1B_IDEMPOTENCY_KEY
      );
      if (existingRun) {
        const existingEvent = dashboard.audit
          .filter(
            (event) =>
              event.eventType === "MARKET_SCOUT_ACTIVITY_SNAPSHOT" &&
              event.entityId === existingRun.id
          )
          .sort((left, right) => right.sequence - left.sequence)[0];
        if (existingEvent) {
          const snapshot = parseMarketScoutActivitySnapshot(
            existingEvent.details.activity
          );
          if (
            snapshot.runId !== existingRun.id ||
            snapshot.query.origin !== "SEARCH" ||
            snapshot.query.countryCode !== SF_DEMO_1B_SCOPE.countryCode ||
            snapshot.query.laneKey !== SF_DEMO_1B_SCOPE.laneKey
          ) {
            throw new Error("SF_DEMO_1B_ACTIVITY_SCOPE_MISMATCH");
          }
          return response("REUSED", snapshot);
        }

        // The persisted run proves work was admitted, not that repeating its
        // external requests is safe. Missing activity needs explicit recovery.
        throw new Error("SF_DEMO_1B_RECOVERY_REQUIRED");
      }

      const result = await runLiveMarketScoutPilot({
        actor: input.actor,
        batchKey: SF_DEMO_1B_IDEMPOTENCY_KEY,
        countryCode: SF_DEMO_1B_SCOPE.countryCode,
        laneKey: SF_DEMO_1B_SCOPE.laneKey,
        source: input.source,
        websiteReviewer: input.websiteReviewer,
        repository: input.repository
      });
      return response("CREATED", result.activity);
    } catch {
      throw new SfDemo1BExecutionError();
    }
  }
}

function response(
  disposition: SfDemo1BExecutionResult["disposition"],
  snapshot: MarketScoutActivitySnapshotV1
): SfDemo1BExecutionResult {
  return {
    contractVersion: SF_DEMO_1B_EXECUTION_VERSION,
    disposition,
    scope: SF_DEMO_1B_SCOPE,
    snapshot
  };
}
