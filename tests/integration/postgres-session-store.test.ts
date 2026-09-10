import { createHash, randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrations";
import type { IssueSessionInput } from "@/modules/identity/application/session-port";
import { PostgresIdentityLinkPort } from "@/modules/identity/infrastructure/postgres-identity-link-port";
import { PostgresSessionStore } from "@/modules/identity/infrastructure/postgres-session-store";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:manovaflow-local-only@127.0.0.1:55432/manovaflow";
const now = new Date("2026-09-04T12:00:00.000Z");
const tenantId = randomUUID();
const actorId = randomUUID();
const issuer = "https://identity.example.test";
const subject = "integration-subject-" + randomUUID();
const testRunId = randomUUID();

describe("Postgres opaque session lifecycle", () => {
  let admin: Sql;
  let store: PostgresSessionStore;

  beforeAll(async () => {
    admin = postgres(databaseUrl, {
      max: 3,
      connect_timeout: 3,
      idle_timeout: 3,
      prepare: false,
      onnotice: () => undefined
    });
    await runMigrations(admin);
    await admin`
      insert into tenants (id, name)
      values (${tenantId}::uuid, 'Session Integration Tenant')
      on conflict (id) do nothing
    `;
    await admin`
      insert into memberships (tenant_id, actor_id, role)
      values (${tenantId}::uuid, ${actorId}::uuid, 'OWNER')
      on conflict (tenant_id, actor_id) do nothing
    `;
    await admin`
      insert into oidc_identities (issuer, subject, actor_id)
      values (${issuer}, ${subject}, ${actorId}::uuid)
      on conflict (issuer, subject) do nothing
    `;
    store = new PostgresSessionStore(admin, { idleTimeoutSeconds: 300 });
  }, 30_000);

  afterAll(async () => {
    if (admin) {
      try {
        await admin`delete from tenants where id = ${tenantId}::uuid`;
        await admin`
          delete from oidc_identities
          where issuer = ${issuer} and subject = ${subject}
        `;
      } finally {
        await admin.end({ timeout: 3 });
      }
    }
  });

  it("resolves a provider subject only through the server-owned identity link", async () => {
    const port = new PostgresIdentityLinkPort(admin);
    await expect(port.resolveActor({ issuer, subject })).resolves.toEqual({ actorId });
    await expect(
      port.resolveActor({ issuer, subject: "unknown-subject" })
    ).resolves.toBeNull();
  });

  it("allows one OIDC exchange and rejects replay of the same verified token", async () => {
    const input = issueInput(oidcHash("single-exchange"));
    const issued = await store.issue(input);

    await expect(store.issue(input)).rejects.toMatchObject({
      code: "OIDC_TOKEN_REPLAYED"
    });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now
      })
    ).resolves.toMatchObject({
      source: "SERVER_VERIFIED_SESSION",
      sessionId: issued.sessionId,
      actorId,
      activeTenantId: tenantId,
      mfa: { method: "amr:mfa" }
    });
  });

  it("binds unsafe authentication to the CSRF secret stored with the credential", async () => {
    const issued = await store.issue(issueInput(oidcHash("csrf-binding")));
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        csrfToken: "x".repeat(43),
        requireCsrf: true,
        now
      })
    ).rejects.toMatchObject({ code: "CSRF_VALIDATION_FAILED" });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        csrfToken: issued.csrfToken,
        requireCsrf: true,
        now
      })
    ).resolves.toMatchObject({ sessionId: issued.sessionId });
  });

  it("rotates atomically and compromises the family when a rotated token is reused", async () => {
    const issued = await store.issue(issueInput(oidcHash("rotation-reuse")));
    const rotated = await store.rotate({
      sessionToken: issued.sessionToken,
      csrfToken: issued.csrfToken,
      now: new Date(now.getTime() + 1_000)
    });

    await expect(
      store.authenticate({
        sessionToken: rotated.sessionToken,
        requireCsrf: false,
        now: new Date(now.getTime() + 2_000)
      })
    ).resolves.toMatchObject({ sessionId: issued.sessionId });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now: new Date(now.getTime() + 3_000)
      })
    ).rejects.toMatchObject({ code: "SESSION_REPLAY_DETECTED" });
    await expect(
      store.authenticate({
        sessionToken: rotated.sessionToken,
        requireCsrf: false,
        now: new Date(now.getTime() + 4_000)
      })
    ).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });

  it("revokes an active session immediately", async () => {
    const issued = await store.issue(issueInput(oidcHash("revocation")));
    await store.revoke({
      sessionToken: issued.sessionToken,
      csrfToken: issued.csrfToken,
      now: new Date(now.getTime() + 1_000)
    });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now: new Date(now.getTime() + 2_000)
      })
    ).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });

  it("serializes concurrent rotation and invalidates the winning token after reuse", async () => {
    const issued = await store.issue(issueInput(oidcHash("concurrent-rotation")));
    const results = await Promise.allSettled([
      store.rotate({
        sessionToken: issued.sessionToken,
        csrfToken: issued.csrfToken,
        now: new Date(now.getTime() + 1_000)
      }),
      store.rotate({
        sessionToken: issued.sessionToken,
        csrfToken: issued.csrfToken,
        now: new Date(now.getTime() + 1_000)
      })
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof store.rotate>>> =>
        result.status === "fulfilled"
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "SESSION_REPLAY_DETECTED" });
    await expect(
      store.authenticate({
        sessionToken: fulfilled[0]!.value.sessionToken,
        requireCsrf: false,
        now: new Date(now.getTime() + 2_000)
      })
    ).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });

  it("rechecks MFA freshness from server state on every authentication", async () => {
    const issued = await store.issue(issueInput(oidcHash("mfa-freshness")));
    await store.authenticate({
      sessionToken: issued.sessionToken,
      requireCsrf: false,
      now: new Date("2026-09-04T12:04:00.000Z")
    });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now: new Date("2026-09-04T12:08:00.000Z")
      })
    ).rejects.toMatchObject({ code: "MFA_EXPIRED" });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now: new Date("2026-09-04T12:08:01.000Z")
      })
    ).rejects.toMatchObject({ code: "SESSION_REVOKED" });
  });

  it("expires a session when the persisted idle deadline is reached", async () => {
    const issued = await store.issue(issueInput(oidcHash("idle-timeout")));

    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now: new Date("2026-09-04T12:05:00.000Z")
      })
    ).rejects.toMatchObject({ code: "SESSION_IDLE_TIMEOUT" });
  });

  it("refreshes idle activity without moving the immutable absolute deadline", async () => {
    const issued = await store.issue(issueInput(oidcHash("idle-refresh")));

    await store.authenticate({
      sessionToken: issued.sessionToken,
      requireCsrf: false,
      now: new Date("2026-09-04T12:04:00.000Z")
    });
    await store.authenticate({
      sessionToken: issued.sessionToken,
      requireCsrf: false,
      now: new Date("2026-09-04T12:07:00.000Z")
    });

    const rows = await admin<
      { idle_expires_at: Date; expires_at: Date }[]
    >`
      select idle_expires_at, expires_at
      from auth_sessions
      where id = ${issued.sessionId}::uuid
    `;
    expect(rows[0]?.idle_expires_at.toISOString()).toBe(
      "2026-09-04T12:10:00.000Z"
    );
    expect(rows[0]?.expires_at.toISOString()).toBe(
      "2026-09-04T12:10:00.000Z"
    );
  });

  it("enforces absolute expiry despite recent activity", async () => {
    const input = issueInput(oidcHash("absolute-timeout"));
    input.identity.expiresAt = "2026-09-04T12:20:00.000Z";
    input.identity.mfa.expiresAt = "2026-09-04T12:20:00.000Z";
    const issued = await store.issue(input);

    await store.authenticate({
      sessionToken: issued.sessionToken,
      requireCsrf: false,
      now: new Date("2026-09-04T12:04:00.000Z")
    });
    await store.authenticate({
      sessionToken: issued.sessionToken,
      requireCsrf: false,
      now: new Date("2026-09-04T12:08:00.000Z")
    });
    await expect(
      store.authenticate({
        sessionToken: issued.sessionToken,
        requireCsrf: false,
        now: new Date("2026-09-04T12:10:00.000Z")
      })
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("expires rather than revokes when revoke is presented after idle timeout", async () => {
    const issued = await store.issue(issueInput(oidcHash("revoke-idle-timeout")));

    await expect(
      store.revoke({
        sessionToken: issued.sessionToken,
        csrfToken: issued.csrfToken,
        now: new Date("2026-09-04T12:05:00.000Z")
      })
    ).rejects.toMatchObject({ code: "SESSION_IDLE_TIMEOUT" });

    const rows = await admin<{ state: string }[]>`
      select state
      from auth_sessions
      where id = ${issued.sessionId}::uuid
    `;
    expect(rows[0]?.state).toBe("EXPIRED");
  });
});

function issueInput(oidcTokenHash: string): IssueSessionInput {
  return {
    identity: {
      issuer,
      subject,
      issuedAt: "2026-09-04T11:59:00.000Z",
      expiresAt: "2026-09-04T12:10:00.000Z",
      mfa: {
        method: "amr:mfa",
        verifiedAt: "2026-09-04T11:58:00.000Z",
        expiresAt: "2026-09-04T12:08:00.000Z"
      }
    },
    actorId,
    tenantId,
    oidcTokenHash,
    expiresAt: "2026-09-04T12:10:00.000Z",
    now
  };
}

function oidcHash(testName: string): string {
  return createHash("sha256").update(testRunId + ":" + testName).digest("hex");
}
