import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../application/auth-port";
import type { IssuedSession } from "../application/session-port";

export const SESSION_COOKIE_NAME = "__Host-manovaflow-session";
export const CSRF_COOKIE_NAME = "__Host-manovaflow-csrf";

const opaqueTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const maximumCookieHeaderLength = 8_192;
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export interface SessionRequestCredentials {
  sessionToken: string;
  csrfToken?: string;
}

export function serializeIssuedSessionCookies(
  session: IssuedSession,
  now: Date = new Date()
): [string, string] {
  assertOpaqueToken(session.sessionToken);
  assertOpaqueToken(session.csrfToken);
  const maxAge = Math.max(
    0,
    Math.floor((Date.parse(session.expiresAt) - now.getTime()) / 1_000)
  );
  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    throw new AuthenticationError("INVALID_SESSION");
  }
  return [
    SESSION_COOKIE_NAME +
      "=" +
      session.sessionToken +
      "; Path=/; Max-Age=" +
      maxAge +
      "; HttpOnly; Secure; SameSite=Strict",
    CSRF_COOKIE_NAME +
      "=" +
      session.csrfToken +
      "; Path=/; Max-Age=" +
      maxAge +
      "; Secure; SameSite=Strict"
  ];
}

export function serializeClearedSessionCookies(): [string, string] {
  return [
    SESSION_COOKIE_NAME +
      "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
    CSRF_COOKIE_NAME + "=; Path=/; Max-Age=0; Secure; SameSite=Strict"
  ];
}

export function requestRequiresCsrf(method: string): boolean {
  return !safeMethods.has(method.toUpperCase());
}

export function readSessionRequestCredentials(
  request: Request,
  applicationOrigin: string,
  requireCsrf: boolean
): SessionRequestCredentials | null {
  const sessionToken = readSingleCookie(request.headers, SESSION_COOKIE_NAME);
  if (!sessionToken) return null;
  assertOpaqueToken(sessionToken);
  if (!requireCsrf) return { sessionToken };

  if (request.headers.get("origin") !== applicationOrigin) {
    throw new AuthenticationError("ORIGIN_VALIDATION_FAILED");
  }
  const csrfCookie = readSingleCookie(request.headers, CSRF_COOKIE_NAME);
  const csrfHeader = request.headers.get("x-csrf-token")?.trim();
  if (!csrfCookie || !csrfHeader) {
    throw new AuthenticationError("CSRF_VALIDATION_FAILED");
  }
  assertOpaqueToken(csrfCookie, "CSRF_VALIDATION_FAILED");
  assertOpaqueToken(csrfHeader, "CSRF_VALIDATION_FAILED");
  if (!constantTimeEqual(csrfCookie, csrfHeader)) {
    throw new AuthenticationError("CSRF_VALIDATION_FAILED");
  }
  return { sessionToken, csrfToken: csrfHeader };
}

export function readCanonicalRateLimitSessionToken(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader || cookieHeader.length > maximumCookieHeaderLength) {
    return null;
  }
  const matches = readCookieValues(cookieHeader, SESSION_COOKIE_NAME);
  if (matches.length !== 1) return null;
  const token = matches[0];
  return token && opaqueTokenPattern.test(token) ? token : null;
}

function readSingleCookie(headers: Headers, name: string): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  if (cookieHeader.length > maximumCookieHeaderLength) {
    throw new AuthenticationError("INVALID_SESSION");
  }
  const matches = readCookieValues(cookieHeader, name);
  if (matches.length > 1) {
    throw new AuthenticationError("INVALID_SESSION");
  }
  return matches[0] ?? null;
}

function readCookieValues(cookieHeader: string, name: string): string[] {
  const matches: string[] = [];
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const candidateName = segment.slice(0, separator).trim();
    if (candidateName === name) {
      matches.push(segment.slice(separator + 1).trim());
    }
  }
  return matches;
}

function assertOpaqueToken(
  value: string,
  code: "INVALID_SESSION" | "CSRF_VALIDATION_FAILED" = "INVALID_SESSION"
): void {
  if (!opaqueTokenPattern.test(value)) {
    throw new AuthenticationError(code);
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "ascii");
  const rightBuffer = Buffer.from(right, "ascii");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
