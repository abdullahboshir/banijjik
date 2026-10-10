import type { UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";

export interface LogoutAllInput {
  readonly userId: UserId;
}

export interface LogoutAllDependencies {
  readonly sessions: RefreshSessionRepository;
  readonly clock: Clock;
}

/** Ends every session of the user, on all devices. Access tokens already issued last at most 15 minutes. */
export class LogoutAllUseCase {
  constructor(private readonly dependencies: LogoutAllDependencies) {}

  async execute(input: LogoutAllInput): Promise<void> {
    const { sessions, clock } = this.dependencies;
    await sessions.revokeAllForUser(input.userId, clock.now());
  }
}
