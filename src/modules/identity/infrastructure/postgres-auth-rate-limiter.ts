import { createHmac } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { z } from "zod";
import { AuthenticationError } from "../application/auth-port";
import {
  AUTH_RATE_LIMIT_OPERATIONS,
  type AuthRateLimitOperation,
  type AuthRateLimitPort,
  type ConsumeAuthRateLimitInput
} from "../application/auth-rate-limit-port";
import { setIdentityRuntimeRole } from "./identity-database";
import { appendSecurityAudit } from "./postgres-security-audit";
import { readCanonicalRateLimitSessionToken } from "./session-cookie";

const configurationSchema = z.strictObject({
  hmacKey: z.string(),
  windowSeconds: z.number().int().min(1).max(3_600),
  maxRequests: z.number().int().min(1).max(10_000),
  globalMaxRequests: z.number().int().min(1).max(100_000),
  blockSeconds: z.number().int().min(1).max(86_400)
});

export interface AuthRateLimitConfiguration {
  hmacKey: string;
  windowSeconds: number;
  maxRequests: number;
  globalMaxRequests: number;
  blockSeconds: number;
}

interface BucketRow {
  window_started_at: Date | string;
  request_count: number;
  blocked_until: Date | string | null;
}

interface BucketOutcome {
  blocked: boolean;
  retryAfterSeconds: number;
}

export class PostgresAuthRateLimiter implements AuthRateLimitPort {
  readonly #sql: Sql;
  readonly #key: Buffer;
  readonly #windowMs: number;
  readonly #maxRequests: number;
  readonly #globalMaxRequests: number;
  readonly #blockMs: number;

  constructor(sql: Sql, rawConfiguration: AuthRateLimitConfiguration) {
    const parsed = configurationSchema.safeParse(rawConfiguration);
    if (!parsed.success) {
      throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
    }
    this.#sql = sql;
    this.#key = decodeHmacKey(parsed.data.hmacKey);
    this.#windowMs = parsed.data.windowSeconds * 1_000;
    this.#maxRequests = parsed.data.maxRequests;
    this.#globalMaxRequests = parsed.data.globalMaxRequests;
    this.#blockMs = parsed.data.blockSeconds * 1_000;
  }

  async consume(input: ConsumeAuthRateLimitInput): Promise<void> {
    if (
      !AUTH_RATE_LIMIT_OPERATIONS.includes(input.operation) ||
      !Number.isFinite(input.now.getTime())
    ) {
      throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
    }
    const subjectContext = canonicalSessionSubjectContext(
      input.request.headers.get("cookie")
    );
    const subjectHash = hmacDigest(
      this.#key,
      input.operation,
      "subject",
      subjectContext
    );
    const globalHash = hmacDigest(
      this.#key,
      input.operation,
      "global",
      "aggregate"
    );

    const blocked = await this.#sql.begin(async (transaction) => {
      await setIdentityRuntimeRole(transaction);
      const globalOutcome = await consumeBucket(transaction, {
        operation: input.operation,
        keyHash: globalHash,
        now: input.now,
        windowMs: this.#windowMs,
        maximum: this.#globalMaxRequests,
        blockMs: this.#blockMs
      });
      if (globalOutcome.blocked) {
        await appendRateLimitAudit(
          transaction,
          input.operation,
          subjectHash,
          "global",
          globalOutcome.retryAfterSeconds,
          input.now
        );
        return globalOutcome;
      }

      const subjectOutcome = await consumeBucket(transaction, {
        operation: input.operation,
        keyHash: subjectHash,
        now: input.now,
        windowMs: this.#windowMs,
        maximum: this.#maxRequests,
        blockMs: this.#blockMs
      });
      if (subjectOutcome.blocked) {
        await appendRateLimitAudit(
          transaction,
          input.operation,
          subjectHash,
          "subject",
          subjectOutcome.retryAfterSeconds,
          input.now
        );
      }
      return subjectOutcome;
    });

    if (blocked.blocked) {
      throw new AuthenticationError("AUTH_RATE_LIMITED", {
        retryAfterSeconds: blocked.retryAfterSeconds
      });
    }
  }
}

export function deriveRateLimitSubject(input: {
  hmacKey: string;
  operation: AuthRateLimitOperation;
  cookieHeader: string | null;
}): string {
  if (!AUTH_RATE_LIMIT_OPERATIONS.includes(input.operation)) {
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
  return hmacDigest(
    decodeHmacKey(input.hmacKey),
    input.operation,
    "subject",
    canonicalSessionSubjectContext(input.cookieHeader)
  );
}

function decodeHmacKey(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");
  }
  return decoded;
}

function canonicalSessionSubjectContext(cookieHeader: string | null): string {
  const sessionToken = readCanonicalRateLimitSessionToken(cookieHeader);
  return sessionToken
    ? `valid-session:${sessionToken}`
    : "anonymous-or-invalid-session";
}

function hmacDigest(
  key: Buffer,
  operation: AuthRateLimitOperation,
  scope: "global" | "subject",
  context: string
): string {
  return createHmac("sha256", key)
    .update(operation, "utf8")
    .update("\0", "utf8")
    .update(scope, "utf8")
    .update("\0", "utf8")
    .update(context, "utf8")
    .digest("hex");
}

async function consumeBucket(
  transaction: TransactionSql,
  input: {
    operation: AuthRateLimitOperation;
    keyHash: string;
    now: Date;
    windowMs: number;
    maximum: number;
    blockMs: number;
  }
): Promise<BucketOutcome> {
  const windowStartedAt = new Date(
    Math.floor(input.now.getTime() / input.windowMs) * input.windowMs
  );
  await transaction`
    insert into auth_rate_limit_buckets (
      operation, key_hash, window_started_at, request_count, updated_at
    ) values (
      ${input.operation}, ${input.keyHash}, ${windowStartedAt}, 0, ${input.now}
    )
    on conflict (operation, key_hash) do nothing
  `;
  const rows = await transaction<BucketRow[]>`
    select window_started_at, request_count, blocked_until
    from auth_rate_limit_buckets
    where operation = ${input.operation}
      and key_hash = ${input.keyHash}
    for update
  `;
  const row = rows[0];
  if (!row) throw new AuthenticationError("AUTH_PROVIDER_UNAVAILABLE");

  const blockedUntil = row.blocked_until
    ? toDate(row.blocked_until).getTime()
    : 0;
  if (blockedUntil > input.now.getTime()) {
    return {
      blocked: true,
      retryAfterSeconds: secondsUntil(blockedUntil, input.now.getTime())
    };
  }

  if (toDate(row.window_started_at).getTime() !== windowStartedAt.getTime()) {
    await transaction`
      update auth_rate_limit_buckets
      set window_started_at = ${windowStartedAt},
          request_count = 1,
          blocked_until = null,
          updated_at = ${input.now}
      where operation = ${input.operation}
        and key_hash = ${input.keyHash}
    `;
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (row.request_count >= input.maximum) {
    const nextWindowAt = windowStartedAt.getTime() + input.windowMs;
    const nextAllowedAt = Math.max(
      nextWindowAt,
      input.now.getTime() + input.blockMs
    );
    await transaction`
      update auth_rate_limit_buckets
      set blocked_until = ${new Date(nextAllowedAt)},
          updated_at = ${input.now}
      where operation = ${input.operation}
        and key_hash = ${input.keyHash}
    `;
    return {
      blocked: true,
      retryAfterSeconds: secondsUntil(nextAllowedAt, input.now.getTime())
    };
  }

  await transaction`
    update auth_rate_limit_buckets
    set request_count = request_count + 1,
        blocked_until = null,
        updated_at = ${input.now}
    where operation = ${input.operation}
      and key_hash = ${input.keyHash}
  `;
  return { blocked: false, retryAfterSeconds: 0 };
}

async function appendRateLimitAudit(
  transaction: TransactionSql,
  operation: AuthRateLimitOperation,
  subjectHash: string,
  scope: "global" | "subject",
  retryAfterSeconds: number,
  occurredAt: Date
): Promise<void> {
  await appendSecurityAudit(transaction, {
    eventType: "AUTH_RATE_LIMIT_BLOCKED",
    outcome: "BLOCKED",
    occurredAt,
    subjectHash,
    requestHash: subjectHash,
    details: { operation, scope, retryAfterSeconds }
  });
}

function secondsUntil(deadlineMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((deadlineMs - nowMs) / 1_000));
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
