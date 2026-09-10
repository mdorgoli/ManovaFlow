import type { Sql } from "postgres";
import type { IdentityLinkPort } from "../application/oidc-session-service";
import { setIdentityRuntimeRole } from "./identity-database";

interface IdentityLinkRow {
  actor_id: string;
}

export class PostgresIdentityLinkPort implements IdentityLinkPort {
  readonly #sql: Sql;

  constructor(sql: Sql) {
    this.#sql = sql;
  }

  async resolveActor(identity: {
    issuer: string;
    subject: string;
  }): Promise<{ actorId: string } | null> {
    return this.#sql.begin(async (tx) => {
      await setIdentityRuntimeRole(tx);
      const rows = await tx<IdentityLinkRow[]>`
        select actor_id
        from oidc_identities
        where issuer = ${identity.issuer}
          and subject = ${identity.subject}
        limit 1
      `;
      const row = rows[0];
      return row ? { actorId: String(row.actor_id) } : null;
    });
  }
}
