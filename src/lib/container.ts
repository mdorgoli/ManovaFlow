import type { Sql } from "postgres";
import { createDatabaseClient } from "./database";
import { createIdentityDatabaseClient } from "@/modules/identity/infrastructure/identity-database";
import type { GrowthRepository } from "@/modules/growth/application/repository";
import { InMemoryGrowthRepository } from "@/modules/growth/infrastructure/in-memory-repository";
import { PostgresGrowthRepository } from "@/modules/growth/infrastructure/postgres-repository";
import { ServiceFlowService } from "@/modules/serviceflow/application/service";
import { InMemoryServiceFlowRepository } from "@/modules/serviceflow/infrastructure/in-memory-repository";

interface ManovaFlowGlobal {
  manovaFlowRepository?: GrowthRepository;
  manovaFlowSql?: Sql;
  manovaFlowIdentitySql?: Sql;
  manovaFlowServiceFlowService?: ServiceFlowService;
}

const shared = globalThis as typeof globalThis & ManovaFlowGlobal;

export function getGrowthRepository(): GrowthRepository {
  if (shared.manovaFlowRepository) return shared.manovaFlowRepository;

  if (process.env.DATABASE_URL) {
    shared.manovaFlowRepository = new PostgresGrowthRepository(getDatabaseClient());
  } else {
    shared.manovaFlowRepository = new InMemoryGrowthRepository();
  }
  return shared.manovaFlowRepository;
}

export function getDatabaseClient(): Sql {
  if (!shared.manovaFlowSql) {
    shared.manovaFlowSql = createDatabaseClient();
  }
  return shared.manovaFlowSql;
}

export function getIdentityDatabaseClient(): Sql {
  if (!shared.manovaFlowIdentitySql) {
    shared.manovaFlowIdentitySql = createIdentityDatabaseClient();
  }
  return shared.manovaFlowIdentitySql;
}

export function getStorageMode(): "POSTGRESQL" | "MEMORY_DEMO" {
  return process.env.DATABASE_URL ? "POSTGRESQL" : "MEMORY_DEMO";
}

export function getServiceFlowService(): ServiceFlowService {
  if (!shared.manovaFlowServiceFlowService) {
    shared.manovaFlowServiceFlowService = new ServiceFlowService(
      new InMemoryServiceFlowRepository()
    );
  }
  return shared.manovaFlowServiceFlowService;
}
