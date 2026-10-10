import { asId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { RefreshSession } from "../domain/refresh-session.entity.js";
import type { RefreshSessionDocument } from "./refresh-session.schema.js";

export function toRefreshSessionDocument(session: RefreshSession): RefreshSessionDocument {
  return {
    refreshSessionId: session.refreshSessionId,
    userId: session.userId,
    familyId: session.familyId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    familyExpiresAt: session.familyExpiresAt,
    rotatedAt: session.rotatedAt ?? null,
    revokedAt: session.revokedAt ?? null,
    replacedByRefreshSessionId: session.replacedByRefreshSessionId ?? null,
    userAgent: session.userAgent ?? null,
    ipHash: session.ipHash ?? null,
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
    createdByUserId: null,
    updatedByUserId: null,
  };
}

export function toRefreshSession(document: RefreshSessionDocument): RefreshSession {
  const stored = stripMongoInternals(document);
  return RefreshSession.restore({
    refreshSessionId: stored.refreshSessionId,
    userId: asId(stored.userId),
    familyId: stored.familyId,
    tokenHash: stored.tokenHash,
    expiresAt: stored.expiresAt,
    familyExpiresAt: stored.familyExpiresAt,
    rotatedAt: stored.rotatedAt ?? undefined,
    revokedAt: stored.revokedAt ?? undefined,
    replacedByRefreshSessionId: stored.replacedByRefreshSessionId ?? undefined,
    userAgent: stored.userAgent ?? undefined,
    ipHash: stored.ipHash ?? undefined,
    createdAt: stored.createdAt,
  });
}
