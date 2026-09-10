import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrations";
import type { IssueSessionInput } from "@/modules/identity/application/session-port";
import { PostgresSessionStore } from "@/modules/identity/infrastructure/postgres-session-store";
import { PostgresAuthRateLimiter } from "@/modules/identity/infrastructure/postgres-auth-rate-limiter";
import { PostgresIdentityMaintenance } from "@/modules/identity/infrastructure/postgres-identity-maintenance";
import { SESSION_COOKIE_NAME } from "@/modules/identity/infrastructure/session-cookie";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:manovaflow-local-only@127.0.0.1:55432/manovaflow";
const now = new Date("2026-09-04T13:00:00.000Z");
const tenantId = randomUUID();
const actorId = randomUUID();
const issuer = "https://identity.example.test";
const subject = `operations-subject-${randomUUID()}`;
const runId = randomUUID();
const cleanupLabels = [
  "cleanup-live",
  "cleanup-stale-one",
  "cleanup-stale-two",
  "cleanup-stale-three",
  "cleanup-old-terminal",
  "cleanup-recent-terminal"
] as const;
type CleanupLabel = (typeof cleanupLabels)[number];

describe("identity operational security", () => {
  let admin: Sql;
  let store: PostgresSessionStore;

  beforeAll(async () => {
    admin = postgres(databaseUrl, {
      max: 4,
      connect_timeout: 3,
      idle_timeout: 3,
      prepare: false,
      onnotice: () => undefined
    });
    await runMigrations(admin);
    await admin`
      insert into tenants (id, name)
      values (${tenantId}::uuid, 'Identity Operations Tenant')
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
    if (!admin) return;
    try {
      await admin`delete from tenants where id = ${tenantId}::uuid`;
      await admin`
        delete from oidc_identities
        where issuer = ${issuer} and subject = ${subject}
      `;
    } finally {
      await admin.end({ timeout: 3 });
    }
  });

  it("persists session security transitions without raw browser credentials", async () => {
    const issued = await store.issue(issueInput("audit-lifecycle"));
    const rotated = await store.rotate({
      sessionToken: issued.sessionToken,
      csrfToken: issued.csrfToken,
      now: new Date(now.getTime() + 1_000)
    });
    await store.revoke({
      sessionToken: rotated.sessionToken,
      csrfToken: rotated.csrfToken,
      now: new Date(now.getTime() + 2_000)
    });

    const rows = await admin<
      { event_type: string; details_text: string }[]
    >`
      select event_type, details::text as details_text
      from identity_security_events
      where session_id = ${issued.sessionId}::uuid
      order by occurred_at, event_type
    `;
    expect(rows.map((row) => row.event_type)).toEqual([
      "OIDC_SESSION_ISSUED",
      "SESSION_ROTATED",
      "SESSION_REVOKED"
    ]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(issued.sessionToken);
    expect(serialized).not.toContain(issued.csrfToken);
    expect(serialized).not.toContain(rotated.sessionToken);
    expect(serialized).not.toContain(rotated.csrfToken);
  });

  it("rejects update and delete of persisted security events", async () => {
    const issued = await store.issue(issueInput("audit-immutable"));

    await expect(
      admin`
        update identity_security_events
        set details = '{"tampered":true}'::jsonb
        where session_id = ${issued.sessionId}::uuid
      `
    ).rejects.toThrow(/append-only/i);
    await expect(
      admin`
        delete from identity_security_events
        where session_id = ${issued.sessionId}::uuid
      `
    ).rejects.toThrow(/append-only/i);
  });

  it("rolls back session issuance when mandatory audit insertion fails", async () => {
    const input = issueInput("audit-required-rollback");
    const before = await admin<{ count: number }[]>`
      select count(*)::integer as count
      from auth_sessions
      where tenant_id = ${tenantId}::uuid
    `;
    await admin`
      revoke insert on identity_security_events
      from manovaflow_identity_runtime
    `;
    try {
      await expect(store.issue(input)).rejects.toThrow(/permission denied/i);
      const consumed = await admin<{ count: number }[]>`
        select count(*)::integer as count
        from consumed_oidc_tokens
        where token_hash = ${input.oidcTokenHash}
      `;
      const after = await admin<{ count: number }[]>`
        select count(*)::integer as count
        from auth_sessions
        where tenant_id = ${tenantId}::uuid
      `;
      expect(consumed[0]?.count).toBe(0);
      expect(after[0]?.count).toBe(before[0]?.count);
    } finally {
      await admin`
        grant insert on identity_security_events
        to manovaflow_identity_runtime
      `;
    }
  });

  it("blocks a repeated request subject and returns the remaining retry delay", async () => {
    const limiter = new PostgresAuthRateLimiter(admin, {
      hmacKey: randomBytes(32).toString("base64url"),
      windowSeconds: 60,
      maxRequests: 2,
      globalMaxRequests: 20,
      blockSeconds: 30
    });
    const request = new Request("https://app.example.test/rotate", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${"s".repeat(43)}` }
    });

    await limiter.consume({ operation: "SESSION_ROTATE", request, now });
    await limiter.consume({ operation: "SESSION_ROTATE", request, now });
    await expect(
      limiter.consume({ operation: "SESSION_ROTATE", request, now })
    ).rejects.toMatchObject({
      code: "AUTH_RATE_LIMITED",
      retryAfterSeconds: 60
    });
    await expect(
      limiter.consume({
        operation: "SESSION_ROTATE",
        request,
        now: new Date(now.getTime() + 10_000)
      })
    ).rejects.toMatchObject({ retryAfterSeconds: 50 });

    const serialized = await admin<{ payload: string }[]>`
      select coalesce(string_agg(key_hash || details::text, ' '), '') as payload
      from auth_rate_limit_buckets
      left join identity_security_events
        on identity_security_events.event_type = 'AUTH_RATE_LIMIT_BLOCKED'
        and identity_security_events.occurred_at >= ${now}
    `;
    expect(serialized[0]?.payload).not.toContain("s".repeat(43));
  });

  it("cannot evade a subject bucket by changing unrelated cookie order or values", async () => {
    const limiter = new PostgresAuthRateLimiter(admin, {
      hmacKey: randomBytes(32).toString("base64url"),
      windowSeconds: 60,
      maxRequests: 2,
      globalMaxRequests: 20,
      blockSeconds: 60
    });
    const sessionCookie = `${SESSION_COOKIE_NAME}=${"u".repeat(43)}`;
    const requests = [
      new Request("https://app.example.test/rotate", {
        headers: { cookie: `theme=dark; ${sessionCookie}; locale=fa` }
      }),
      new Request("https://app.example.test/rotate", {
        headers: { cookie: `locale=en; ${sessionCookie}; theme=light` }
      }),
      new Request("https://app.example.test/rotate", {
        headers: { cookie: `${sessionCookie}; tracking=${runId}` }
      })
    ];

    await limiter.consume({ operation: "SESSION_ROTATE", request: requests[0]!, now });
    await limiter.consume({ operation: "SESSION_ROTATE", request: requests[1]!, now });
    await expect(
      limiter.consume({
        operation: "SESSION_ROTATE",
        request: requests[2]!,
        now
      })
    ).rejects.toMatchObject({ code: "AUTH_RATE_LIMITED" });
  });

  it("rate-limits duplicate session-cookie variants through one invalid fallback", async () => {
    const limiter = new PostgresAuthRateLimiter(admin, {
      hmacKey: randomBytes(32).toString("base64url"),
      windowSeconds: 60,
      maxRequests: 1,
      globalMaxRequests: 20,
      blockSeconds: 60
    });
    const firstToken = "d".repeat(43);
    const secondToken = "e".repeat(43);
    const first = new Request("https://app.example.test/rotate", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${firstToken}; ${SESSION_COOKIE_NAME}=${secondToken}`
      }
    });
    const reordered = new Request("https://app.example.test/rotate", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${secondToken}; theme=dark; ${SESSION_COOKIE_NAME}=${firstToken}`
      }
    });

    await limiter.consume({ operation: "SESSION_ROTATE", request: first, now });
    await expect(
      limiter.consume({ operation: "SESSION_ROTATE", request: reordered, now })
    ).rejects.toMatchObject({ code: "AUTH_RATE_LIMITED" });
  });

  it("enforces a global operation limit across distinct request subjects", async () => {
    const limiter = new PostgresAuthRateLimiter(admin, {
      hmacKey: randomBytes(32).toString("base64url"),
      windowSeconds: 60,
      maxRequests: 10,
      globalMaxRequests: 2,
      blockSeconds: 30
    });

    for (const suffix of ["one", "two"]) {
      await limiter.consume({
        operation: "SESSION_REVOKE",
        request: new Request("https://app.example.test/revoke", {
          headers: { cookie: `session=${runId}-${suffix}` }
        }),
        now
      });
    }
    await expect(
      limiter.consume({
        operation: "SESSION_REVOKE",
        request: new Request("https://app.example.test/revoke", {
          headers: { cookie: `session=${runId}-three` }
        }),
        now
      })
    ).rejects.toMatchObject({ code: "AUTH_RATE_LIMITED" });
  });

  it("serializes concurrent subject consumption without exceeding the limit", async () => {
    const limiter = new PostgresAuthRateLimiter(admin, {
      hmacKey: randomBytes(32).toString("base64url"),
      windowSeconds: 60,
      maxRequests: 1,
      globalMaxRequests: 100,
      blockSeconds: 60
    });
    const request = new Request("https://app.example.test/rotate", {
      headers: { cookie: `session=${runId}-concurrent` }
    });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        limiter.consume({ operation: "SESSION_ROTATE", request, now })
      )
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    expect(rejected).toHaveLength(3);
    expect(
      rejected.every(
        (result) => result.reason instanceof Error &&
          "code" in result.reason &&
          result.reason.code === "AUTH_RATE_LIMITED"
      )
    ).toBe(true);
  });

  it("domain-separates the global bucket from attacker-controlled cookie text", async () => {
    const before = await admin<{ count: number }[]>`
      select count(*)::integer as count
      from auth_rate_limit_buckets
      where operation = 'SESSION_ROTATE'
    `;
    const limiter = new PostgresAuthRateLimiter(admin, {
      hmacKey: randomBytes(32).toString("base64url"),
      windowSeconds: 60,
      maxRequests: 10,
      globalMaxRequests: 100,
      blockSeconds: 60
    });
    await limiter.consume({
      operation: "SESSION_ROTATE",
      request: new Request("https://app.example.test/rotate", {
        headers: { cookie: "global" }
      }),
      now
    });
    const after = await admin<{ count: number }[]>`
      select count(*)::integer as count
      from auth_rate_limit_buckets
      where operation = 'SESSION_ROTATE'
    `;

    expect(after[0]!.count - before[0]!.count).toBe(2);
  });

  it("cleans identity state in bounded batches without purging live or recent sessions", async () => {
    const cleanupNow = new Date("2026-09-05T13:00:00.000Z");
    const futureAbsolute = new Date("2026-09-05T15:00:00.000Z");
    const futureIdle = new Date("2026-09-05T14:00:00.000Z");
    const sessionIds = {} as Record<CleanupLabel, string>;
    for (const label of cleanupLabels) {
      sessionIds[label] = (await store.issue(issueInput(label))).sessionId;
    }

    await admin`
      update auth_sessions
      set expires_at = ${futureAbsolute},
          idle_expires_at = ${futureIdle},
          mfa_expires_at = ${futureAbsolute},
          revoked_at = case
            when state = 'ACTIVE' then null
            else ${cleanupNow}
          end
      where tenant_id = ${tenantId}::uuid
    `;
    await admin`
      update auth_session_credentials c
      set expires_at = ${futureAbsolute}
      from auth_sessions s
      where s.id = c.session_id
        and s.tenant_id = ${tenantId}::uuid
    `;
    await admin`
      update auth_sessions
      set idle_expires_at = ${new Date(cleanupNow.getTime() - 60_000)}
      where id in (
        ${sessionIds["cleanup-stale-one"]}::uuid,
        ${sessionIds["cleanup-stale-two"]}::uuid,
        ${sessionIds["cleanup-stale-three"]}::uuid
      )
    `;
    await admin`
      update auth_sessions
      set state = 'REVOKED',
          revoked_at = ${new Date("2000-01-01T00:00:00.000Z")}
      where id = ${sessionIds["cleanup-old-terminal"]}::uuid
    `;
    await admin`
      update auth_sessions
      set state = 'REVOKED',
          revoked_at = ${new Date(cleanupNow.getTime() - 1_800_000)}
      where id = ${sessionIds["cleanup-recent-terminal"]}::uuid
    `;

    const maintenance = new PostgresIdentityMaintenance(admin);
    const first = await maintenance.cleanup({
      now: cleanupNow,
      batchSize: 2,
      retentionSeconds: 3_600
    });
    expect(first.expiredSessions).toBeGreaterThan(0);
    expect(first.expiredSessions).toBeLessThanOrEqual(2);
    expect(first.purgedSessions).toBeGreaterThanOrEqual(1);
    expect(first.purgedSessions).toBeLessThanOrEqual(2);

    let remainingStale = await countActiveCleanupSessions(admin, sessionIds);
    let passes = 1;
    while (remainingStale > 0 && passes < 20) {
      const next = await maintenance.cleanup({
        now: cleanupNow,
        batchSize: 2,
        retentionSeconds: 3_600
      });
      expect(next.expiredSessions).toBeLessThanOrEqual(2);
      expect(next.purgedSessions).toBeLessThanOrEqual(2);
      remainingStale = await countActiveCleanupSessions(admin, sessionIds);
      passes += 1;
    }
    expect(remainingStale).toBe(0);
    expect(passes).toBeGreaterThan(1);

    const survivors = await admin<{ id: string; state: string }[]>`
      select id, state
      from auth_sessions
      where id in (
        ${sessionIds["cleanup-live"]}::uuid,
        ${sessionIds["cleanup-recent-terminal"]}::uuid
      )
      order by id
    `;
    expect(survivors).toHaveLength(2);
    expect(
      survivors.find((row) => row.id === sessionIds["cleanup-live"])?.state
    ).toBe("ACTIVE");
    expect(
      survivors.find(
        (row) => row.id === sessionIds["cleanup-recent-terminal"]
      )?.state
    ).toBe("REVOKED");

    const purgedRows = await admin<{ count: number }[]>`
      select count(*)::integer as count
      from auth_sessions
      where id = ${sessionIds["cleanup-old-terminal"]}::uuid
    `;
    expect(purgedRows[0]?.count).toBe(0);
    const retainedAudit = await admin<{ event_type: string }[]>`
      select event_type
      from identity_security_events
      where session_id = ${sessionIds["cleanup-old-terminal"]}::uuid
      order by occurred_at, event_type
    `;
    expect(retainedAudit.map((row) => row.event_type)).toContain(
      "SESSION_PURGED"
    );
  });
});

function issueInput(label: string): IssueSessionInput {
  return {
    identity: {
      issuer,
      subject,
      issuedAt: "2026-09-04T12:59:00.000Z",
      expiresAt: "2026-09-04T13:15:00.000Z",
      mfa: {
        method: "amr:mfa",
        verifiedAt: "2026-09-04T12:58:00.000Z",
        expiresAt: "2026-09-04T13:12:00.000Z"
      }
    },
    actorId,
    tenantId,
    oidcTokenHash: createHash("sha256")
      .update(`${runId}:${label}`)
      .digest("hex"),
    expiresAt: "2026-09-04T13:15:00.000Z",
    now
  };
}

async function countActiveCleanupSessions(
  sql: Sql,
  sessionIds: Record<CleanupLabel, string>
): Promise<number> {
  const rows = await sql<{ count: number }[]>`
    select count(*)::integer as count
    from auth_sessions
    where id in (
      ${sessionIds["cleanup-stale-one"]}::uuid,
      ${sessionIds["cleanup-stale-two"]}::uuid,
      ${sessionIds["cleanup-stale-three"]}::uuid
    ) and state = 'ACTIVE'
  `;
  return rows[0]?.count ?? 0;
}
