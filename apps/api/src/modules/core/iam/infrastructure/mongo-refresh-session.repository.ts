import { TOKEN_AUDIENCE, type TokenAudience } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { RefreshSessionRepository } from "../application/ports/refresh-session-repository.js";
import type { RefreshSession } from "../domain/refresh-session.entity.js";
import { toRefreshSession, toRefreshSessionDocument } from "./refresh-session.mapper.js";
import {
  REFRESH_SESSION_MODEL_NAME,
  type RefreshSessionDocument,
} from "./refresh-session.schema.js";

export class MongoRefreshSessionRepository implements RefreshSessionRepository {
  async insert(session: RefreshSession): Promise<void> {
    await this.model().create(
      [toRefreshSessionDocument(session)],
      sessionOption(getActiveSession()),
    );
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | undefined> {
    const document = await this.model()
      .findOne({ tokenHash }, null, sessionOption(getActiveSession()))
      .lean<RefreshSessionDocument>();
    return document === null ? undefined : toRefreshSession(document);
  }

  /** One atomic conditional update: of two concurrent callers, only one sees modifiedCount 1. */
  async markRotated(
    refreshSessionId: string,
    replacedByRefreshSessionId: string,
    at: Date,
  ): Promise<boolean> {
    const result = await this.model().updateOne(
      { refreshSessionId, rotatedAt: null, revokedAt: null },
      { $set: { rotatedAt: at, replacedByRefreshSessionId } },
      sessionOption(getActiveSession()),
    );
    return result.modifiedCount === 1;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.model().updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: at } },
      sessionOption(getActiveSession()),
    );
  }

  async revokeAllForUser(userId: UserId, audience: TokenAudience, at: Date): Promise<void> {
    // A row without an audience is an ADMIN session (the mapper reads it the same way).
    const audiences = audience === TOKEN_AUDIENCE.ADMIN ? [audience, null] : [audience];
    await this.model().updateMany(
      { userId, revokedAt: null, audience: { $in: audiences } },
      { $set: { revokedAt: at } },
      sessionOption(getActiveSession()),
    );
  }

  async revoke(refreshSessionId: string, at: Date): Promise<void> {
    await this.model().updateOne(
      { refreshSessionId, revokedAt: null },
      { $set: { revokedAt: at } },
      sessionOption(getActiveSession()),
    );
  }

  private model() {
    return models({}).get<RefreshSessionDocument>(REFRESH_SESSION_MODEL_NAME);
  }
}
