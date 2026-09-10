import type { Sql } from "postgres";
import { getApplicationDatabaseRole } from "@/lib/database";
import type {
  MembershipPort,
  VerifiedMembership
} from "../application/auth-port";

interface MembershipRow {
  tenant_id: string;
  actor_id: string;
  role: string;
}

export class PostgresMembershipPort implements MembershipPort {
  readonly #sql: Sql;
  readonly #clock: () => Date;
  readonly #databaseRole: string;

  constructor(
    sql: Sql,
    clock: () => Date = () => new Date(),
    environment: Record<string, string | undefined> = process.env
  ) {
    this.#sql = sql;
    this.#clock = clock;
    this.#databaseRole = getApplicationDatabaseRole(environment);
  }

  async resolveMembership(identity: {
    actorId: string;
    tenantId: string;
  }): Promise<VerifiedMembership | null> {
    return (await this.#sql.begin(async (tx) => {
      await tx`set local role ${tx(this.#databaseRole)}`;
      await tx`select set_config('app.tenant_id', ${identity.tenantId}, true)`;
      await tx`select set_config('app.actor_id', ${identity.actorId}, true)`;
      const rows = await tx<MembershipRow[]>`
        select tenant_id, actor_id, role
        from memberships
        where tenant_id = ${identity.tenantId}::uuid
          and actor_id = ${identity.actorId}::uuid
        limit 1
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        tenantId: String(row.tenant_id),
        actorId: String(row.actor_id),
        role: String(row.role),
        verifiedAt: this.#clock().toISOString()
      };
    })) as VerifiedMembership | null;
  }
}
