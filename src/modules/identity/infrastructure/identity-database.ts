import postgres, { type Sql, type TransactionSql } from "postgres";
import { AuthenticationError } from "../application/auth-port";

export interface IdentityDatabaseConfiguration {
  applicationUrl: string;
  identityUrl: string;
}

export function parseIdentityDatabaseConfiguration(
  environment: Record<string, string | undefined>
): IdentityDatabaseConfiguration {
  try {
    const applicationUrl = requirePostgresUrl(environment.DATABASE_URL);
    const identityUrl = requirePostgresUrl(environment.IDENTITY_DATABASE_URL);
    const application = new URL(applicationUrl);
    const identity = new URL(identityUrl);
    const applicationUsername = decodeURIComponent(application.username);
    const identityUsername = decodeURIComponent(identity.username);

    if (
      applicationUsername.length === 0 ||
      identityUsername.length === 0 ||
      applicationUsername.toLocaleLowerCase("en-US") ===
        identityUsername.toLocaleLowerCase("en-US") ||
      databaseEndpoint(application) !== databaseEndpoint(identity)
    ) {
      throw new Error("Identity database credentials are not isolated");
    }

    return { applicationUrl, identityUrl };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
}

export function createIdentityDatabaseClient(databaseUrl?: string): Sql {
  const url = requirePostgresUrl(
    databaseUrl ?? process.env.IDENTITY_DATABASE_URL
  );
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
    onnotice: () => undefined
  });
}

export async function setIdentityRuntimeRole(
  transaction: TransactionSql
): Promise<void> {
  await transaction`set local role manovaflow_identity_runtime`;
  await transaction`set local row_security = on`;
  await transaction`
    select
      pg_catalog.set_config('search_path', 'pg_catalog, public', true),
      pg_catalog.set_config('app.tenant_id', '', true),
      pg_catalog.set_config('app.actor_id', '', true)
  `;
  const rows = await transaction<
    {
      current_role: string;
      search_path: string;
      tenant_id: string | null;
      actor_id: string | null;
    }[]
  >`
    select
      current_role,
      current_setting('search_path') as search_path,
      nullif(current_setting('app.tenant_id', true), '') as tenant_id,
      nullif(current_setting('app.actor_id', true), '') as actor_id
  `;
  const context = rows[0];
  if (
    context?.current_role !== "manovaflow_identity_runtime" ||
    context.search_path !== "pg_catalog, public" ||
    context.tenant_id !== null ||
    context.actor_id !== null
  ) {
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
}

function requirePostgresUrl(value: string | undefined): string {
  if (!value) throw new Error("PostgreSQL URL is required");
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("PostgreSQL URL protocol is invalid");
  }
  return value;
}

function databaseEndpoint(url: URL): string {
  const effectivePort = url.port || "5432";
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || database.includes("/")) {
    throw new Error("PostgreSQL endpoint is invalid");
  }
  return `${url.hostname.toLocaleLowerCase("en-US")}:${effectivePort}/${database}`;
}
