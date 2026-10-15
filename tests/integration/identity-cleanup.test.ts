import { createHash, randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrations";
import { PostgresIdentityMaintenance } from "@/modules/identity/infrastructure/postgres-identity-maintenance";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:manovaflow-local-only@127.0.0.1:55432/manovaflow";
const issuer = "https://cleanup.identity.example.test";
const subject = `cleanup-subject-${randomUUID()}`;
const actorId = randomUUID();
const testRunId = randomUUID();
const expiredDigest = digest(`${testRunId}:expired-oidc`);
const validDigest = digest(`${testRunId}:valid-oidc`);
const staleBucketHash = digest(`${testRunId}:stale-rate`);
const freshBucketHash = digest(`${testRunId}:fresh-rate`);
const blockedBucketHash = digest(`${testRunId}:blocked-rate`);
const cleanupNow = new Date("2001-01-01T00:00:00.000Z");

describe("identity cleanup artifact accounting", () => {
  let admin: Sql;

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
      insert into oidc_identities (issuer, subject, actor_id)
      values (${issuer}, ${subject}, ${actorId}::uuid)
    `;
  }, 30_000);

  afterAll(async () => {
    if (!admin) return;
    try {
      await admin`
        delete from auth_rate_limit_buckets
        where key_hash in (
          ${staleBucketHash},
          ${freshBucketHash},
          ${blockedBucketHash}
        )
      `;
      await admin`
        delete from oidc_identities
        where issuer = ${issuer} and subject = ${subject}
      `;
    } finally {
      await admin.end({ timeout: 3 });
    }
  });

  it("deletes only expired digests and stale buckets with exact report counts", async () => {
    await admin`
      insert into consumed_oidc_tokens (
        token_hash, issuer, subject, consumed_at, expires_at
      ) values
        (
          ${expiredDigest}, ${issuer}, ${subject},
          '1899-01-01T00:00:00.000Z'::timestamptz,
          '1900-01-01T00:00:00.000Z'::timestamptz
        ),
        (
          ${validDigest}, ${issuer}, ${subject},
          '2000-01-01T00:00:00.000Z'::timestamptz,
          '2002-01-01T00:00:00.000Z'::timestamptz
        )
    `;
    await admin`
      insert into auth_rate_limit_buckets (
        operation, key_hash, window_started_at,
        request_count, blocked_until, updated_at
      ) values
        (
          'SESSION_ROTATE', ${staleBucketHash},
          '1900-01-01T00:00:00.000Z'::timestamptz,
          1, null, '1900-01-01T00:00:00.000Z'::timestamptz
        ),
        (
          'SESSION_ROTATE', ${freshBucketHash},
          ${cleanupNow}, 1, null, ${cleanupNow}
        ),
        (
          'SESSION_ROTATE', ${blockedBucketHash},
          '1900-01-01T00:00:00.000Z'::timestamptz,
          1,
          '2002-01-01T00:00:00.000Z'::timestamptz,
          '1900-01-01T00:00:00.000Z'::timestamptz
        )
    `;

    try {
      const eligibleBefore = await eligibleArtifactCounts(admin);
      const result = await new PostgresIdentityMaintenance(admin).cleanup({
        now: cleanupNow,
        batchSize: 10,
        retentionSeconds: 3_600
      });
      const eligibleAfter = await eligibleArtifactCounts(admin);

      expect(result.oidcDigestsDeleted).toBe(1);
      expect(result.rateBucketsDeleted).toBe(1);
      expect(result.oidcDigestsDeleted).toBe(
        eligibleBefore.oidcDigests - eligibleAfter.oidcDigests
      );
      expect(result.rateBucketsDeleted).toBe(
        eligibleBefore.rateBuckets - eligibleAfter.rateBuckets
      );

      const digests = await admin<{ token_hash: string }[]>`
        select token_hash
        from consumed_oidc_tokens
        where token_hash in (${expiredDigest}, ${validDigest})
        order by token_hash
      `;
      expect(digests.map((row) => row.token_hash.trim())).toEqual([
        validDigest
      ]);

      const buckets = await admin<{ key_hash: string }[]>`
        select key_hash
        from auth_rate_limit_buckets
        where key_hash in (
          ${staleBucketHash},
          ${freshBucketHash},
          ${blockedBucketHash}
        )
        order by key_hash
      `;
      expect(buckets.map((row) => row.key_hash.trim()).sort()).toEqual(
        [freshBucketHash, blockedBucketHash].sort()
      );
    } finally {
      await admin`
        delete from consumed_oidc_tokens
        where token_hash in (${expiredDigest}, ${validDigest})
      `;
      await admin`
        delete from auth_rate_limit_buckets
        where key_hash in (
          ${staleBucketHash},
          ${freshBucketHash},
          ${blockedBucketHash}
        )
      `;
    }
  });
});

async function eligibleArtifactCounts(sql: Sql): Promise<{
  oidcDigests: number;
  rateBuckets: number;
}> {
  const retentionCutoff = new Date(cleanupNow.getTime() - 3_600_000);
  const rows = await sql<{ oidc_digests: number; rate_buckets: number }[]>`
    select
      (
        select count(*)::integer
        from consumed_oidc_tokens
        where expires_at <= ${cleanupNow}
      ) as oidc_digests,
      (
        select count(*)::integer
        from auth_rate_limit_buckets
        where updated_at < ${retentionCutoff}
          and (blocked_until is null or blocked_until <= ${cleanupNow})
      ) as rate_buckets
  `;
  return {
    oidcDigests: rows[0]?.oidc_digests ?? 0,
    rateBuckets: rows[0]?.rate_buckets ?? 0
  };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
