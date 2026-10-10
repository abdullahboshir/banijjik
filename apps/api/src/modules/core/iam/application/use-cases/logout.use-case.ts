import { TOKEN_AUDIENCE, type TokenAudience } from "@banijjik/contracts";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";
import { hashRefreshToken } from "../refresh-token-secret.js";

export interface LogoutInput {
  readonly refreshToken: string | undefined;
}

export interface LogoutDependencies {
  readonly sessions: RefreshSessionRepository;
  readonly clock: Clock;
  /** The audience whose sessions this logout ends; defaults to ADMIN. */
  readonly audience?: TokenAudience;
}

/** Ends this device session. It always succeeds: logging out twice, or with no cookie, is fine. */
export class LogoutUseCase {
  constructor(private readonly dependencies: LogoutDependencies) {}

  async execute(input: LogoutInput): Promise<void> {
    const { sessions, clock } = this.dependencies;
    if (input.refreshToken === undefined || input.refreshToken === "") return;
    const session = await sessions.findByTokenHash(hashRefreshToken(input.refreshToken));
    if (session === undefined) return;
    // A token of the other app is left alone: logging out of one app never ends a session of the other.
    if (session.audience !== (this.dependencies.audience ?? TOKEN_AUDIENCE.ADMIN)) return;
    await sessions.revoke(session.refreshSessionId, clock.now());
  }
}
