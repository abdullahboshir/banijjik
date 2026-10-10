import { getLogger } from "../../../../../kernel/logger/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { REFRESH_REUSE_GRACE_SECONDS } from "../../domain/auth-limits.js";
import { RefreshRaceError, sessionNotValid } from "../../domain/errors.js";
import type { RefreshSession } from "../../domain/refresh-session.entity.js";
import type { RefreshSessionRepository } from "../ports/refresh-session-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { UserRepository } from "../ports/user-repository.js";
import { hashRefreshToken } from "../refresh-token-secret.js";
import type { ClientInfo, IssuedSession, SessionIssuer } from "../session-issuer.js";

export interface RefreshSessionInput {
  readonly refreshToken: string | undefined;
  readonly client: ClientInfo;
}

export interface RefreshSessionDependencies {
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
  readonly sessionIssuer: SessionIssuer;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
}

/**
 * Rotating refresh tokens with reuse detection (plan 1.1 decision 12). A token works once; its
 * successor takes over. Showing an old token again after the grace window means it was copied,
 * so the whole family is revoked.
 */
export class RefreshSessionUseCase {
  constructor(private readonly dependencies: RefreshSessionDependencies) {}

  async execute(input: RefreshSessionInput): Promise<IssuedSession> {
    const session = await this.findUsableSession(input.refreshToken);
    await this.assertUserMayContinue(session);
    return this.rotate(session, input.client);
  }

  private async findUsableSession(refreshToken: string | undefined): Promise<RefreshSession> {
    const { sessions, clock } = this.dependencies;
    if (refreshToken === undefined || refreshToken === "") throw sessionNotValid();
    const session = await sessions.findByTokenHash(hashRefreshToken(refreshToken));
    if (session === undefined || session.isRevoked()) throw sessionNotValid();
    const now = clock.now();
    // Rotation is checked before expiry: an old copied token must revoke the family even once it expired.
    if (session.isRotated()) return this.rejectRotated(session, now);
    if (session.isExpired(now)) throw sessionNotValid();
    return session;
  }

  /** A rotated token never works again: inside the grace window it is a race, later it is a reuse. */
  private async rejectRotated(session: RefreshSession, now: Date): Promise<never> {
    if (session.wasRotatedWithin(now, REFRESH_REUSE_GRACE_SECONDS)) throw new RefreshRaceError();
    await this.dependencies.sessions.revokeFamily(session.familyId, now);
    getLogger().warn(
      {
        event: "auth.refresh_reuse_detected",
        userId: session.userId,
        familyId: session.familyId,
      },
      "refresh token reuse detected, session family revoked",
    );
    throw sessionNotValid();
  }

  /** A locked or disabled account loses its sessions at the next refresh. */
  private async assertUserMayContinue(session: RefreshSession): Promise<void> {
    const { users, sessions, clock } = this.dependencies;
    const user = await users.findById(session.userId);
    if (user === undefined) {
      await sessions.revokeFamily(session.familyId, clock.now());
      throw sessionNotValid();
    }
    try {
      user.assertCanAuthenticate();
    } catch (error) {
      await sessions.revokeFamily(session.familyId, clock.now());
      throw error;
    }
  }

  private async rotate(session: RefreshSession, client: ClientInfo): Promise<IssuedSession> {
    const { sessions, sessionIssuer, unitOfWork, clock } = this.dependencies;
    const prepared = await sessionIssuer.continueFamily(session, client);
    const wasRotated = await unitOfWork.run(async () => {
      const isFirst = await sessions.markRotated(
        session.refreshSessionId,
        prepared.session.refreshSessionId,
        clock.now(),
      );
      if (isFirst) await sessions.insert(prepared.session);
      return isFirst;
    });
    // Another request rotated this token between our read and our update: exactly one request wins.
    if (!wasRotated) throw new RefreshRaceError();
    return prepared.issued;
  }
}
