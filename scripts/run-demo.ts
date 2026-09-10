import type { Sql } from "postgres";
import { createDatabaseClient } from "../src/lib/database";
import { getDemoContext } from "../src/lib/demo-context";
import { runAllLanes } from "../src/modules/growth/application/run-parallel";
import type { GrowthRepository } from "../src/modules/growth/application/repository";
import { syntheticFixtures } from "../src/modules/growth/demo/fixtures";
import { InMemoryGrowthRepository } from "../src/modules/growth/infrastructure/in-memory-repository";
import { PostgresGrowthRepository } from "../src/modules/growth/infrastructure/postgres-repository";

const actor = getDemoContext();
let sql: Sql | null = null;
let repository: GrowthRepository;

if (process.env.DATABASE_URL) {
  sql = createDatabaseClient();
  repository = new PostgresGrowthRepository(sql);
} else {
  repository = new InMemoryGrowthRepository();
}

try {
  const result = await runAllLanes({
    actor,
    batchKey: "synthetic-cli-" + Date.now(),
    inputsByLane: syntheticFixtures,
    repository
  });
  const lanes = Object.fromEntries(
    Object.entries(result.laneResults).map(([laneKey, outcome]) => [
      laneKey,
      outcome.status === "fulfilled"
        ? {
            status: outcome.report.status,
            state: outcome.report.state,
            packState: outcome.report.packState,
            markets: outcome.report.marketShortlist.length,
            eligibleCompanies: outcome.report.companyShortlist.length,
            drafts: outcome.report.drafts.length,
            outboundActions: outcome.report.outboundActions,
            humanSendTokens: outcome.report.complianceDecisions.filter(
              (decision) => decision.authorizationToken !== null
            ).length
          }
        : { status: "FAILED", error: outcome.error, attempts: outcome.attempts }
    ])
  );

  process.stdout.write(
    JSON.stringify(
      {
        mode: process.env.DATABASE_URL ? "POSTGRESQL" : "MEMORY_DEMO",
        syntheticCompanies: Object.values(syntheticFixtures).flat().length,
        aggregate: result.aggregate,
        lanes
      },
      null,
      2
    ) + "\n"
  );

  const unsafe =
    result.aggregate.lanesFailed > 0 ||
    result.aggregate.outboundActions !== 0 ||
    Object.values(result.laneResults).some(
      (outcome) =>
        outcome.status === "fulfilled" &&
        outcome.report.complianceDecisions.some(
          (decision) => decision.authorizationToken !== null
        )
    );
  if (unsafe) {
    process.exitCode = 1;
  }
} finally {
  if (sql) await sql.end({ timeout: 5 });
}
