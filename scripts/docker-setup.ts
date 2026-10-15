import { createDatabaseClient } from "../src/lib/database";
import { runMigrations } from "../src/lib/migrations";

const password = process.env.DOCKER_APP_PASSWORD;
if (!password || !/^[a-zA-Z0-9]{16,}$/.test(password)) {
  throw new Error(
    "DOCKER_APP_PASSWORD must contain at least 16 alphanumeric characters"
  );
}

const sql = createDatabaseClient();
try {
  await runMigrations(sql);
  await sql.begin(async (transaction) => {
    await transaction`select pg_advisory_xact_lock(5571329337904328803::bigint)`;
    const [role] =
      await transaction`select 1 from pg_roles where rolname = 'manovaflow_web'`;
    if (!role) await transaction.unsafe("CREATE ROLE manovaflow_web LOGIN");
    const [statement] = await transaction`
      select format(
        'ALTER ROLE manovaflow_web WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
        ${password}::text
      ) as command
    `;
    await transaction.unsafe(statement!.command as string);
    await transaction.unsafe("GRANT manovaflow_app TO manovaflow_web");
  });
  console.log("Docker schema and application database login are ready.");
} finally {
  await sql.end({ timeout: 5 });
}
