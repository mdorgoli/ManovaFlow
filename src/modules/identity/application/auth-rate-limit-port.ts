export const AUTH_RATE_LIMIT_OPERATIONS = [
  "SESSION_ROTATE",
  "SESSION_REVOKE"
] as const;

export type AuthRateLimitOperation =
  (typeof AUTH_RATE_LIMIT_OPERATIONS)[number];

export interface ConsumeAuthRateLimitInput {
  operation: AuthRateLimitOperation;
  request: Request;
  now: Date;
}

export interface AuthRateLimitPort {
  consume(input: ConsumeAuthRateLimitInput): Promise<void>;
}
