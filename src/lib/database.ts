import postgres, { type Sql } from "postgres";

export function getApplicationDatabaseRole(
  environment: Record<string, string | undefined> = process.env
): string {
  const role = environment.DATABASE_APPLICATION_ROLE ?? "manovaflow_app";
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) {
    throw new Error("Invalid application database role");
  }
  return role;
}

export function createDatabaseClient(databaseUrl?: string): Sql {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for PostgreSQL mode");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use postgres or postgresql protocol");
  }

  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
    onnotice: () => undefined
  });
}
