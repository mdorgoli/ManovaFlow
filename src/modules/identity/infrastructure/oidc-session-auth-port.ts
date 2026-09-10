import type { AuthPort, VerifiedSession } from "../application/auth-port";
import type { SessionStorePort } from "../application/session-port";
import {
  readSessionRequestCredentials,
  requestRequiresCsrf
} from "./session-cookie";

export interface OidcSessionAuthPortConfiguration {
  store: SessionStorePort;
  applicationOrigin: string;
  clock?: () => Date;
}

export class OidcSessionAuthPort implements AuthPort {
  readonly #store: SessionStorePort;
  readonly #applicationOrigin: string;
  readonly #clock: () => Date;

  constructor(configuration: OidcSessionAuthPortConfiguration) {
    const origin = new URL(configuration.applicationOrigin);
    if (origin.protocol !== "https:" || origin.origin !== configuration.applicationOrigin) {
      throw new Error("Application origin must be an exact HTTPS origin");
    }
    this.#store = configuration.store;
    this.#applicationOrigin = origin.origin;
    this.#clock = configuration.clock ?? (() => new Date());
  }

  async resolveSession(request: Request): Promise<VerifiedSession | null> {
    const requireCsrf = requestRequiresCsrf(request.method);
    const credentials = readSessionRequestCredentials(
      request,
      this.#applicationOrigin,
      requireCsrf
    );
    if (!credentials) return null;
    return this.#store.authenticate({
      sessionToken: credentials.sessionToken,
      requireCsrf,
      ...(credentials.csrfToken ? { csrfToken: credentials.csrfToken } : {}),
      now: this.#clock()
    });
  }
}

