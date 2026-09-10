import { createDatabaseClient } from "../src/lib/database";
import { runMigrations } from "../src/lib/migrations";

const sql = createDatabaseClient();

try {
  await runMigrations(sql);
  process.stdout.write("ManovaFlow migrations applied.\n");
} finally {
  await sql.end({ timeout: 5 });
}
