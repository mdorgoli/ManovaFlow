import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/database";
import { resolveRequestActor } from "@/lib/request-auth";
import { parseCandidate } from "@/modules/growth/domain/candidate-schema";
import type { ActorContext } from "@/modules/growth/domain/types";
import { PostgresGrowthRepository } from "@/modules/growth/infrastructure/postgres-repository";

// This suite never provisions databases, migrates schemas, or uses an admin login.
// The fixed local acceptance database is provisioned separately by its administrator.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("Explicit isolated TEST_DATABASE_URL is required");
const target = new URL(databaseUrl);
if (
  target.hostname !== "127.0.0.1" ||
  target.pathname !== "/manovaflow_scout_test" ||
  target.username !== "manovaflow_scout_test_runtime"
) throw new Error("Refusing to run storage acceptance outside the isolated local test database");

const actorA: ActorContext = {
  tenantId: "30000000-0000-4000-8000-000000000001",
  actorId: "40000000-0000-4000-8000-000000000001",
  role: "OWNER"
};
const actorB: ActorContext = {
  tenantId: "30000000-0000-4000-8000-000000000002",
  actorId: "40000000-0000-4000-8000-000000000002",
  role: "OWNER"
};
const sql = createDatabaseClient(databaseUrl);
const repository = new PostgresGrowthRepository(sql);

describe("isolated PostgreSQL scout storage with a restricted login", () => {
  beforeAll(async () => {
    const [connection] = await sql`select current_database() as database, session_user as login`;
    expect(connection).toEqual({ database: "manovaflow_scout_test", login: "manovaflow_scout_test_runtime" });
  });

  afterAll(async () => { await sql.end({ timeout: 3 }); });

  it("cannot administer the server, assume existing application roles, or connect to the app database", async () => {
    const [role] = await sql`
      select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls,
        pg_has_role(current_user, 'manovaflow_app', 'MEMBER') as shared_app_role,
        pg_has_role(current_user, 'manovaflow_identity_runtime', 'MEMBER') as identity_role,
        has_database_privilege(current_user, 'manovaflow_scout_local', 'CONNECT') as app_connect
      from pg_roles where rolname = current_user
    `;
    expect(role).toEqual({ rolsuper: false, rolcreatedb: false, rolcreaterole: false,
      rolbypassrls: false, shared_app_role: false, identity_role: false, app_connect: false });
    await expect(sql`set role postgres`).rejects.toMatchObject({ code: "42501" });
    await expect(sql`select * from auth_session_credentials`).rejects.toMatchObject({ code: "42501" });
  });

  it("retains a company across a new pool and deduplicates only within its tenant", async () => {
    const domain = `storage-${randomUUID()}.example`;
    const candidate = parseCandidate({ laneKey: "serviceflow", marketKey: "fr-france",
      companyName: "Storage acceptance — FICTIONAL TEST ONLY", domain, country: "FR",
      sourceUrl: `https://${domain}/services`, sourceKind: "SYNTHETIC", synthetic: true,
      signalKeys: [], marketSignalKeys: [], riskFlags: [] });
    const saved = await repository.saveCompany(actorA, candidate);
    const newPool = createDatabaseClient(databaseUrl);
    try {
      const reopened = new PostgresGrowthRepository(newPool);
      expect(await reopened.findCompany(actorA, domain)).toEqual(saved.company);
      expect(await reopened.findCompany(actorB, domain)).toBeNull();
      const replay = await reopened.saveCompany(actorA, candidate);
      expect(replay.created).toBe(false);
      expect(replay.company.id).toBe(saved.company.id);
    } finally { await newPool.end({ timeout: 3 }); }
  });

  it("resolves the demo actor against real persisted membership using the restricted role", async () => {
    const actor = await resolveRequestActor(new Request("http://127.0.0.1:3105/api/dashboard"), {
      NODE_ENV: "development", DEMO_MODE: "true", DATABASE_URL: databaseUrl,
      DATABASE_APPLICATION_ROLE: "manovaflow_scout_test_runtime",
      DEMO_TENANT_ID: actorA.tenantId, DEMO_ACTOR_ID: actorA.actorId, DEMO_ACTOR_ROLE: "OWNER"
    }, new Date(), sql);
    expect(actor).toEqual(actorA);
  });

  it("persists the OPEN_DATASET source accepted by discovery without relabeling it synthetic", async () => {
    // Deliberately exercises the public-data schema using an offline .test fixture.
    // No URL is requested and this record exists only in the isolated test database.
    const domain = `open-data-${randomUUID()}.test`;
    const candidate = parseCandidate({ laneKey: "serviceflow", marketKey: "fr-france",
      companyName: "OPEN_DATASET schema fixture — NOT A REAL LEAD", domain, country: "FR",
      sourceUrl: `https://${domain}/dataset`, sourceKind: "OPEN_DATASET", synthetic: false,
      signalKeys: [], marketSignalKeys: [], riskFlags: [] });
    const { company } = await repository.saveCompany(actorA, candidate);
    expect(await repository.findCompany(actorA, domain)).toMatchObject({
      id: company.id, sourceKind: "OPEN_DATASET", synthetic: false, sourceUrl: candidate.sourceUrl
    });
  });

  it("still rejects unknown source kinds at the database boundary", async () => {
    await expect(sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${actorA.tenantId}, true)`;
      await tx`insert into companies
        (tenant_id, company_name, domain, normalized_domain, country, source_url, source_kind, synthetic)
        values (${actorA.tenantId}::uuid, 'Invalid schema fixture', 'invalid.test', 'invalid.test',
          'FR', 'https://invalid.test', 'UNTRUSTED_UNKNOWN_SOURCE', false)`;
    })).rejects.toMatchObject({ code: "23514", constraint_name: "companies_source_kind_check" });
  });

  it("round-trips a structured run summary instead of returning encoded JSON text", async () => {
    const { run } = await repository.beginRun(actorA, "serviceflow", `summary-${randomUUID()}`);
    const summary = { outcome: "TEST_ONLY", counts: { reviewed: 2 }, reasons: ["UNVERIFIED_NEED"] };
    expect((await repository.completeRun(actorA, run.id, summary)).summary).toEqual(summary);
    expect((await repository.getDashboard(actorA)).runs.find((r) => r.id === run.id)?.summary).toEqual(summary);
    const rows = await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${actorA.tenantId}, true)`;
      return tx`select jsonb_typeof(summary) as kind from research_runs where id = ${run.id}::uuid`;
    });
    expect(rows[0]?.kind).toBe("object");
  });

  it("persists a Tehran research score with blocked authorization while rejecting unknown markets", async () => {
    const { run } = await repository.beginRun(actorA, "serviceflow", `iran-schema-${randomUUID()}`);
    const score = await repository.saveMarketScore(actorA, {
      runId: run.id, laneKey: "serviceflow", marketKey: "ir-tehran", total: 0,
      confidence: "LOW", explanation: []
    });
    expect(score.marketKey).toBe("ir-tehran");
    const decision = await repository.saveComplianceDecision(actorA, {
      decisionKey: `iran-schema-${run.id}`, laneKey: "serviceflow", marketKey: "ir-tehran",
      targetStage: "HUMAN_SEND", status: "HUMAN_SEND_BLOCKED", authorizationToken: null,
      recordedAt: new Date().toISOString()
    });
    expect(decision.authorizationToken).toBeNull();
    const snapshot = await repository.getDashboard(actorA);
    expect(snapshot.marketScores.find(item => item.id === score.id)?.total).toBe(0);
    expect((await repository.getDashboard(actorB)).marketScores.some(item => item.id === score.id)).toBe(false);
    await expect(sql.begin(async tx => {
      await tx`select set_config('app.tenant_id', ${actorA.tenantId}, true)`;
      await tx`insert into market_scores (tenant_id, run_id, lane_key, market_key, total, confidence, explanation)
        values (${actorA.tenantId}::uuid, ${run.id}::uuid, 'serviceflow', 'unknown-market', 0, 'LOW', '[]'::jsonb)`;
    })).rejects.toMatchObject({ code: "23514", constraint_name: "market_scores_market_key_check" });
  });

  it("reads legacy JSON-string summaries without rewriting recorded history", async () => {
    const { run } = await repository.beginRun(actorA, "serviceflow", `legacy-${randomUUID()}`);
    const summary = { fixture: "legacy-storage", metrics: { paidSpend: 0 } };
    await sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${actorA.tenantId}, true)`;
      await tx`update research_runs set summary = to_jsonb(${JSON.stringify(summary)}::text),
        status = 'COMPLETED', completed_at = now() where id = ${run.id}::uuid`;
    });
    expect((await repository.getDashboard(actorA)).runs.find((r) => r.id === run.id)?.summary).toEqual(summary);
  });

  it("enforces RLS even when a caller bypasses the repository", async () => {
    const rows = await sql`select * from companies`;
    expect(rows).toHaveLength(0);
    await expect(sql.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${actorA.tenantId}, true)`;
      await tx`insert into research_runs (tenant_id, lane_key, idempotency_key, status)
        values (${actorB.tenantId}::uuid, 'serviceflow', ${randomUUID()}, 'RUNNING')`;
    })).rejects.toMatchObject({ code: "42501" });
  });

  it("retains audit evidence and rejects tampering under the runtime account", async () => {
    const event = await repository.appendAudit(actorA, { eventType: "STORAGE_ACCEPTANCE_TEST",
      laneKey: "serviceflow", entityId: randomUUID(), details: { fixture: true, requests: 0 } });
    await expect(sql`update audit_events set event_type = 'TAMPERED' where id = ${event.id}::uuid`)
      .rejects.toMatchObject({ code: "42501" });
    await expect(sql`delete from audit_events where id = ${event.id}::uuid`)
      .rejects.toMatchObject({ code: "42501" });
    expect((await repository.getDashboard(actorA)).audit.find((row) => row.id === event.id)).toEqual(event);
    expect((await repository.getDashboard(actorB)).audit.find((row) => row.id === event.id)).toBeUndefined();
  });
});
