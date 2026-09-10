import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrations";
import { setIdentityRuntimeRole } from "@/modules/identity/infrastructure/identity-database";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:manovaflow-local-only@127.0.0.1:55432/manovaflow";

describe("identity database privilege and pool boundary", () => {
  let admin: Sql;

  beforeAll(async () => {
    admin = postgres(databaseUrl, {
      max: 4,
      connect_timeout: 3,
      idle_timeout: 3,
      prepare: false,
      onnotice: () => undefined
    });
    await runMigrations(admin);
  }, 30_000);

  afterAll(async () => {
    if (admin) await admin.end({ timeout: 3 });
  });

  it("denies identity role access to tenant data and application role access to identity state", async () => {
    await expect(
      admin.begin(async (tx) => {
        await tx`set local role manovaflow_identity_runtime`;
        await tx`select count(*) from companies`;
      })
    ).rejects.toThrow(/permission denied/i);

    await expect(
      admin.begin(async (tx) => {
        await tx`set local role manovaflow_app`;
        await tx`select count(*) from auth_sessions`;
      })
    ).rejects.toThrow(/permission denied/i);
  });

  it("keeps role and tenant settings transaction-local under concurrent pool reuse", async () => {
    const tenantIds = Array.from(
      { length: 16 },
      (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    );
    const scoped = await Promise.all(
      tenantIds.map((tenantId) =>
        admin.begin(async (tx) => {
          await tx`set local role manovaflow_app`;
          await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
          const rows = await tx<{ current_role: string; tenant_id: string | null }[]>`
            select current_role, current_setting('app.tenant_id', true) as tenant_id
          `;
          return rows[0];
        })
      )
    );
    expect(scoped).toEqual(
      tenantIds.map((tenantId) => ({
        current_role: "manovaflow_app",
        tenant_id: tenantId
      }))
    );

    const unscoped = await Promise.all(
      tenantIds.slice(0, 8).map(() =>
        admin.begin(async (tx) => {
          const rows = await tx<{ current_role: string; tenant_id: string | null }[]>`
            select current_role, nullif(current_setting('app.tenant_id', true), '') as tenant_id
          `;
          return rows[0];
        })
      )
    );
    expect(unscoped.every((row) => row?.current_role === "postgres")).toBe(true);
    expect(unscoped.every((row) => row?.tenant_id === null)).toBe(true);
  });

  it("overrides inherited search path and clears tenant context in identity transactions", async () => {
    const scoped = await admin.begin(async (tx) => {
      await tx`select set_config('search_path', 'pg_temp', true)`;
      await tx`select set_config('app.tenant_id', '10000000-0000-4000-8000-000000000999', true)`;
      await tx`select set_config('app.actor_id', '20000000-0000-4000-8000-000000000999', true)`;
      await setIdentityRuntimeRole(tx);
      const rows = await tx<
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
      return rows[0];
    });

    expect(scoped).toEqual({
      current_role: "manovaflow_identity_runtime",
      search_path: "pg_catalog, public",
      tenant_id: null,
      actor_id: null
    });
  });

  it("repairs BYPASSRLS, role-attribute, and ACL drift on migration rerun", async () => {
    await admin`
      alter role manovaflow_identity_runtime
        bypassrls
        createdb
        createrole
        inherit
        replication
    `;
    await admin`
      grant create on schema public to manovaflow_identity_runtime
    `;
    await admin`
      grant select, update, delete, truncate
      on identity_security_events
      to manovaflow_identity_runtime
    `;
    await admin`
      grant truncate on auth_sessions to manovaflow_identity_runtime
    `;
    await admin`
      grant insert on oidc_identities to manovaflow_identity_runtime
    `;
    await admin`
      grant select on companies to manovaflow_identity_runtime
    `;

    try {
      await runMigrations(admin);
      const roles = await admin<
        {
          rolcanlogin: boolean;
          rolsuper: boolean;
          rolcreatedb: boolean;
          rolcreaterole: boolean;
          rolinherit: boolean;
          rolreplication: boolean;
          rolbypassrls: boolean;
        }[]
      >`
        select
          rolcanlogin,
          rolsuper,
          rolcreatedb,
          rolcreaterole,
          rolinherit,
          rolreplication,
          rolbypassrls
        from pg_roles
        where rolname = 'manovaflow_identity_runtime'
      `;
      expect(roles[0]).toEqual({
        rolcanlogin: false,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolinherit: false,
        rolreplication: false,
        rolbypassrls: false
      });

      const privileges = await admin<
        {
          schema_usage: boolean;
          schema_create: boolean;
          business_select: boolean;
          identity_select: boolean;
          identity_insert: boolean;
          session_select: boolean;
          session_insert: boolean;
          session_update: boolean;
          session_delete: boolean;
          session_truncate: boolean;
          audit_insert: boolean;
          audit_select: boolean;
          audit_update: boolean;
          audit_delete: boolean;
          audit_truncate: boolean;
          rate_select: boolean;
          rate_insert: boolean;
          rate_update: boolean;
          rate_delete: boolean;
          rate_truncate: boolean;
        }[]
      >`
        select
          has_schema_privilege(
            'manovaflow_identity_runtime', 'public', 'usage'
          ) as schema_usage,
          has_schema_privilege(
            'manovaflow_identity_runtime', 'public', 'create'
          ) as schema_create,
          has_table_privilege(
            'manovaflow_identity_runtime', 'companies', 'select'
          ) as business_select,
          has_table_privilege(
            'manovaflow_identity_runtime', 'oidc_identities', 'select'
          ) as identity_select,
          has_table_privilege(
            'manovaflow_identity_runtime', 'oidc_identities', 'insert'
          ) as identity_insert,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_sessions', 'select'
          ) as session_select,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_sessions', 'insert'
          ) as session_insert,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_sessions', 'update'
          ) as session_update,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_sessions', 'delete'
          ) as session_delete,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_sessions', 'truncate'
          ) as session_truncate,
          has_table_privilege(
            'manovaflow_identity_runtime', 'identity_security_events', 'insert'
          ) as audit_insert,
          has_table_privilege(
            'manovaflow_identity_runtime', 'identity_security_events', 'select'
          ) as audit_select,
          has_table_privilege(
            'manovaflow_identity_runtime', 'identity_security_events', 'update'
          ) as audit_update,
          has_table_privilege(
            'manovaflow_identity_runtime', 'identity_security_events', 'delete'
          ) as audit_delete,
          has_table_privilege(
            'manovaflow_identity_runtime', 'identity_security_events', 'truncate'
          ) as audit_truncate,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_rate_limit_buckets', 'select'
          ) as rate_select,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_rate_limit_buckets', 'insert'
          ) as rate_insert,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_rate_limit_buckets', 'update'
          ) as rate_update,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_rate_limit_buckets', 'delete'
          ) as rate_delete,
          has_table_privilege(
            'manovaflow_identity_runtime', 'auth_rate_limit_buckets', 'truncate'
          ) as rate_truncate
      `;
      expect(privileges[0]).toEqual({
        schema_usage: true,
        schema_create: false,
        business_select: false,
        identity_select: true,
        identity_insert: false,
        session_select: true,
        session_insert: true,
        session_update: true,
        session_delete: true,
        session_truncate: false,
        audit_insert: true,
        audit_select: false,
        audit_update: false,
        audit_delete: false,
        audit_truncate: false,
        rate_select: true,
        rate_insert: true,
        rate_update: true,
        rate_delete: true,
        rate_truncate: false
      });
    } finally {
      await admin`
        alter role manovaflow_identity_runtime
          nologin
          nosuperuser
          nocreatedb
          nocreaterole
          noinherit
          noreplication
          nobypassrls
      `;
      await admin`
        revoke all on schema public from manovaflow_identity_runtime
      `;
      await admin`
        revoke all on table
          oidc_identities,
          auth_sessions,
          identity_security_events,
          companies
        from manovaflow_identity_runtime
      `;
      await runMigrations(admin);
    }
  });
});
