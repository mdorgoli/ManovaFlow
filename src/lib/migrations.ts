import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Sql } from "postgres";

const migrationUrls = [
  new URL("../../db/migrations/0001_growth_core.sql", import.meta.url),
  new URL("../../db/migrations/0002_identity_sessions.sql", import.meta.url),
  new URL("../../db/migrations/0003_identity_operations.sql", import.meta.url),
  new URL(
    "../../db/migrations/0004_growth_open_dataset_source.sql",
    import.meta.url
  ),
  new URL(
    "../../db/migrations/0005_growth_iran_research_market.sql",
    import.meta.url
  )
] as const;

export async function runMigrations(sql: Sql): Promise<void> {
  const sources = await Promise.all(
    migrationUrls.map((migrationUrl) =>
      readFile(fileURLToPath(migrationUrl), "utf8")
    )
  );
  await sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(5571329337904328802::bigint)`;
    for (const source of sources) await transaction.unsafe(source);
  });
}
