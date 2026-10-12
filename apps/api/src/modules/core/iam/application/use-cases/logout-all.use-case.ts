import { TOKEN_AUDIENCE, type TokenAudience } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";

export interface LogoutAllInput {
  readonly userId: UserId;
}

export interface LogoutAllDependencies {
  readonly sessions: RefreshSessionRepository;
  readonly clock: Clock;
  /** The audience whose sessions this ends; defaults to ADMIN. */
  readonly audience?: TokenAudience;
}

/** Ends every session of the user for this audience, on all devices. Access tokens already issued last at most 15 minutes. */
export class LogoutAllUseCase {
  constructor(private readonly dependencies: LogoutAllDependencies) {}

  async execute(input: LogoutAllInput): Promise<void> {
    const { sessions, clock } = this.dependencies;
    await sessions.revokeAllForUser(
      input.userId,
      this.dependencies.audience ?? TOKEN_AUDIENCE.ADMIN,
      clock.now(),
    );
  }
}
