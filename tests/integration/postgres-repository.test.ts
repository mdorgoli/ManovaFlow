import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "@/lib/migrations";
import { parseCandidate } from "@/modules/growth/domain/candidate-schema";
import type { ActorContext } from "@/modules/growth/domain/types";
import { PostgresGrowthRepository } from "@/modules/growth/infrastructure/postgres-repository";
import {
  authenticateRequest,
  type AuthPort,
  type VerifiedSession
} from "@/modules/identity/application/auth-port";
import { PostgresMembershipPort } from "@/modules/identity/infrastructure/postgres-membership-port";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:manovaflow-local-only@127.0.0.1:55432/manovaflow";

describe("PostgresGrowthRepository integration", () => {
  let admin: Sql;
  let repository: PostgresGrowthRepository;
  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const actorA: ActorContext = {
    tenantId: tenantAId,
    actorId: randomUUID(),
    role: "OWNER"
  };
  const actorB: ActorContext = {
    tenantId: tenantBId,
    actorId: randomUUID(),
    role: "OWNER"
  };

  beforeAll(async () => {
    admin = postgres(databaseUrl, {
      max: 2,
      connect_timeout: 3,
      idle_timeout: 3,
      prepare: false,
      onnotice: () => undefined
    });
    await runMigrations(admin);
    await admin`
      insert into tenants (id, name)
      values
        (${tenantAId}::uuid, 'Integration Tenant A'),
        (${tenantBId}::uuid, 'Integration Tenant B')
      on conflict (id) do nothing
    `;
    await admin`
      insert into memberships (tenant_id, actor_id, role)
      values
        (${tenantAId}::uuid, ${actorA.actorId}::uuid, 'OWNER'),
        (${tenantBId}::uuid, ${actorB.actorId}::uuid, 'OWNER')
      on conflict (tenant_id, actor_id) do nothing
    `;
    repository = new PostgresGrowthRepository(admin);
  }, 30_000);

  afterAll(async () => {
    if (admin) {
      await admin.end({ timeout: 3 });
    }
  });

  it("enforces cross-tenant visibility and tenant-wide dedupe", async () => {
    const candidate = parseCandidate({
      laneKey: "serviceflow",
      marketKey: "fr-france",
      companyName: "Postgres Atelier — DEMO FICTIONAL",
      domain: "postgres-atelier.example",
      country: "FR",
      sourceUrl: "https://postgres-atelier.example/services",
      sourceKind: "SYNTHETIC",
      synthetic: true,
      signalKeys: ["non_emergency_maintenance"],
      marketSignalKeys: [],
      riskFlags: []
    });

    const first = await repository.saveCompany(actorA, candidate);
    const duplicate = await repository.saveCompany(actorA, {
      ...candidate,
      laneKey: "beautyflow"
    });

    expect(duplicate.created).toBe(false);
    expect(duplicate.company.id).toBe(first.company.id);
    expect(await repository.findCompany(actorB, candidate.domain)).toBeNull();
    expect((await repository.getDashboard(actorB)).companies).toHaveLength(0);
  });

  it("keeps server-authenticated tenant contexts isolated through the shared pool", async () => {
    const membershipPort = new PostgresMembershipPort(
      admin,
      () => new Date("2026-09-04T08:00:00.000Z")
    );
    const authenticatedA = await authenticateRequest({
      request: new Request("https://manovaflow.example/api/research/run"),
      authPort: fixedAuthPort(actorA),
      membershipPort,
      policy: {
        environment: "production",
        now: new Date("2026-09-04T08:00:00.000Z")
      }
    });
    const authenticatedB = await authenticateRequest({
      request: new Request("https://manovaflow.example/api/dashboard"),
      authPort: fixedAuthPort(actorB),
      membershipPort,
      policy: {
        environment: "production",
        now: new Date("2026-09-04T08:00:00.000Z")
      }
    });
    const domain = "auth-boundary-" + randomUUID() + ".example";
    const candidate = parseCandidate({
      laneKey: "serviceflow",
      marketKey: "fr-france",
      companyName: "Authenticated Tenant Boundary — DEMO FICTIONAL",
      domain,
      country: "FR",
      sourceUrl: "https://" + domain + "/services",
      sourceKind: "SYNTHETIC",
      synthetic: true,
      signalKeys: ["non_emergency_maintenance"],
      marketSignalKeys: [],
      riskFlags: []
    });

    await repository.saveCompany(authenticatedA, candidate);

    expect(await repository.findCompany(authenticatedA, domain)).not.toBeNull();
    expect(await repository.findCompany(authenticatedB, domain)).toBeNull();
  });

  it("reuses duplicate run keys and keeps suppression tenant-wide", async () => {
    const first = await repository.beginRun(actorA, "serviceflow", "pg-idempotent");
    const replay = await repository.beginRun(actorA, "serviceflow", "pg-idempotent");
    await repository.suppressDomain(actorA, "blocked.example", "integration DNC");

    expect(replay.reused).toBe(true);
    expect(replay.run.id).toBe(first.run.id);
    expect(await repository.isSuppressed(actorA, "blocked.example")).toBe(true);
    expect(await repository.isSuppressed(actorB, "blocked.example")).toBe(false);
  });

  it("blocks update and delete of audit events at the database boundary", async () => {
    const event = await repository.appendAudit(actorA, {
      eventType: "INTEGRATION_APPEND_ONLY",
      laneKey: "serviceflow",
      entityId: "integration",
      details: { safe: true }
    });

    await expect(
      admin`update audit_events set event_type = 'TAMPERED' where id = ${event.id}::uuid`
    ).rejects.toThrow(/append-only/i);
    await expect(
      admin`delete from audit_events where id = ${event.id}::uuid`
    ).rejects.toThrow(/append-only/i);
  });
});

function fixedAuthPort(actor: ActorContext): AuthPort {
  const session: VerifiedSession = {
    source: "SERVER_VERIFIED_SESSION",
    sessionId: "integration-session-" + randomUUID(),
    actorId: actor.actorId,
    activeTenantId: actor.tenantId,
    issuedAt: "2026-09-04T06:00:00.000Z",
    expiresAt: "2026-09-04T10:00:00.000Z",
    mfa: {
      method: "webauthn",
      verifiedAt: "2026-09-04T07:55:00.000Z",
      expiresAt: "2026-09-04T09:00:00.000Z"
    }
  };
  return {
    resolveSession: async () => session
  };
}
