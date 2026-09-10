import { createIdentityDatabaseClient } from "../src/modules/identity/infrastructure/identity-database";
import { PostgresIdentityMaintenance } from "../src/modules/identity/infrastructure/postgres-identity-maintenance";

const identityDatabaseUrl = process.env.IDENTITY_DATABASE_URL;
if (!identityDatabaseUrl) {
  throw new Error("IDENTITY_DATABASE_URL is required for identity cleanup");
}

const batchSize = readInteger("IDENTITY_CLEANUP_BATCH_SIZE", 1, 1_000);
const retentionSeconds = readInteger(
  "IDENTITY_CLEANUP_RETENTION_SECONDS",
  60,
  31_536_000
);
const sql = createIdentityDatabaseClient(identityDatabaseUrl);

try {
  const maintenance = new PostgresIdentityMaintenance(sql);
  const result = await maintenance.cleanup({
    now: new Date(),
    batchSize,
    retentionSeconds
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await sql.end({ timeout: 5 });
}

function readInteger(name: string, minimum: number, maximum: number): number {
  const rawValue = process.env[name];
  if (!rawValue || !/^\d+$/.test(rawValue)) {
    throw new Error(`${name} must be an integer`);
  }
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} is outside its supported range`);
  }
  return value;
}
