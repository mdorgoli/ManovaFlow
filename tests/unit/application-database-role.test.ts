import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "@/lib/database";
import { PostgresGrowthRepository } from "@/modules/growth/infrastructure/postgres-repository";
import { PostgresMembershipPort } from "@/modules/identity/infrastructure/postgres-membership-port";

// Construction does not connect. Invalid role configuration must fail before any SQL.
const sql = createDatabaseClient(
  "postgresql://unused:unused@127.0.0.1:1/unused"
);
afterAll(async () => {
  await sql.end({ timeout: 1 });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("application database role configuration", () => {
  it.each([
    "",
    "role; reset role",
    'role"',
    "role name",
    "1role",
    "x".repeat(64)
  ])(
    "rejects unsafe or invalid identifiers before opening a connection: %j",
    (role) => {
      vi.stubEnv("DATABASE_APPLICATION_ROLE", role);
      expect(() => new PostgresGrowthRepository(sql)).toThrow(/database role/i);
      expect(() => new PostgresMembershipPort(sql)).toThrow(/database role/i);
    }
  );
});
