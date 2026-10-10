import { asId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { User } from "../domain/user.entity.js";
import type { UserDocument } from "./user.schema.js";

/** The document to insert. Optional fields that are absent are left out, not stored as null. */
export function toUserDocument(user: User): UserDocument {
  return {
    userId: user.userId,
    name: user.name,
    passwordHash: user.passwordHash,
    status: user.status,
    preferredLocale: user.preferredLocale,
    version: user.version,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdByUserId: null,
    updatedByUserId: null,
    ...(user.email === undefined ? {} : { email: user.email }),
    ...(user.phoneE164 === undefined ? {} : { phoneE164: user.phoneE164 }),
    ...(user.emailVerifiedAt === undefined ? {} : { emailVerifiedAt: user.emailVerifiedAt }),
    ...(user.phoneVerifiedAt === undefined ? {} : { phoneVerifiedAt: user.phoneVerifiedAt }),
    ...(user.avatarFileId === undefined ? {} : { avatarFileId: user.avatarFileId }),
    ...(user.lastLoginAt === undefined ? {} : { lastLoginAt: user.lastLoginAt }),
  };
}

/** Builds the domain user from a lean read; Mongo internals are dropped first (ADR-036). */
export function toUser(document: UserDocument): User {
  const stored = stripMongoInternals(document);
  return User.restore({
    userId: asId(stored.userId),
    name: stored.name,
    email: stored.email,
    phoneE164: stored.phoneE164,
    passwordHash: stored.passwordHash,
    status: stored.status,
    emailVerifiedAt: stored.emailVerifiedAt,
    phoneVerifiedAt: stored.phoneVerifiedAt,
    preferredLocale: stored.preferredLocale,
    avatarFileId: stored.avatarFileId,
    lastLoginAt: stored.lastLoginAt,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}
