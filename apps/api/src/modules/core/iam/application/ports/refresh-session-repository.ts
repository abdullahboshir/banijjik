import type { TokenAudience } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { RefreshSession } from "../../domain/refresh-session.entity.js";

export interface RefreshSessionRepository {
  insert(session: RefreshSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshSession | undefined>;
  /**
   * Marks a session rotated only if it is still unrotated and unrevoked, in one atomic update.
   * Returns false when someone else got there first, so two concurrent refreshes cannot both win.
   */
  markRotated(
    refreshSessionId: string,
    replacedByRefreshSessionId: string,
    at: Date,
  ): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
  /** Ends the user's sessions of one audience only; the other app stays signed in (ADR-093). */
  revokeAllForUser(userId: UserId, audience: TokenAudience, at: Date): Promise<void>;
  revoke(refreshSessionId: string, at: Date): Promise<void>;
}
