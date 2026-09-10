import { createDatabaseClient } from "../src/lib/database";
import { getDemoContext } from "../src/lib/demo-context";
import { growthManifests } from "../src/modules/growth/manifests";
import { marketProfiles } from "../src/modules/growth/markets";

const actor = getDemoContext();
const secondTenantId = "10000000-0000-4000-8000-000000000002";
const secondActorId = "20000000-0000-4000-8000-000000000002";
const sql = createDatabaseClient();

try {
  await sql`
    insert into tenants (id, name)
    values
      (${actor.tenantId}::uuid, 'ManovaFlow Synthetic Demo'),
      (${secondTenantId}::uuid, 'Isolation Control Tenant')
    on conflict (id) do update set name = excluded.name
  `;
  await sql`
    insert into memberships (tenant_id, actor_id, role)
    values
      (${actor.tenantId}::uuid, ${actor.actorId}::uuid, ${actor.role}),
      (${secondTenantId}::uuid, ${secondActorId}::uuid, 'VIEWER')
    on conflict (tenant_id, actor_id) do update set role = excluded.role
  `;

  for (const manifest of Object.values(growthManifests)) {
    await sql`
      insert into lane_states (
        tenant_id, lane_key, state, pack_state, outbound_enabled
      ) values (
        ${actor.tenantId}::uuid, ${manifest.key}, 'RESEARCH_ONLY',
        ${manifest.packState}, false
      )
      on conflict (tenant_id, lane_key)
      do update set
        state = 'RESEARCH_ONLY',
        pack_state = excluded.pack_state,
        outbound_enabled = false,
        updated_at = now()
    `;
  }

  for (const profile of Object.values(marketProfiles)) {
    await sql`
      insert into market_profile_snapshots (
        tenant_id, market_key, profile, research_only
      ) values (
        ${actor.tenantId}::uuid, ${profile.key},
        ${JSON.stringify(profile)}::jsonb, true
      )
      on conflict (tenant_id, market_key)
      do update set
        profile = excluded.profile,
        research_only = true,
        captured_at = now()
    `;
  }

  await sql`
    insert into suppressions (tenant_id, normalized_domain, reason)
    values (
      ${actor.tenantId}::uuid,
      'suppressed-company.example',
      'Synthetic tenant-wide DNC fixture'
    )
    on conflict (tenant_id, normalized_domain) do nothing
  `;

  process.stdout.write(
    "Seeded 2 fictional tenants, 3 Research-Only lanes, 4 market snapshots and 1 tenant-wide suppression.\n"
  );
} finally {
  await sql.end({ timeout: 5 });
}
