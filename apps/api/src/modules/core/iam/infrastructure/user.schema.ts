import {
  PREFERRED_LOCALE,
  USER_STATUS,
  type PreferredLocale,
  type UserStatus,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const USER_MODEL_NAME = "User";
export const USER_COLLECTION_NAME = "users";

/** The stored shape of a user. Absent optional fields are not stored at all. */
export interface UserDocument {
  userId: string;
  name: string;
  email?: string;
  phoneE164?: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  preferredLocale: PreferredLocale;
  avatarFileId?: string;
  lastLoginAt?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const userSchema = new Schema<UserDocument>(
  {
    ...domainIdField("userId"),
    name: { type: String, required: true },
    email: { type: String },
    phoneE164: { type: String },
    passwordHash: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(USER_STATUS) },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    preferredLocale: { type: String, required: true, enum: Object.values(PREFERRED_LOCALE) },
    avatarFileId: { type: String },
    lastLoginAt: { type: Date },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

userSchema.index({ userId: 1 }, { unique: true });
// Partial, so many users may have no email (or no phone) while a present value stays unique.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
userSchema.index(
  { phoneE164: 1 },
  { unique: true, partialFilterExpression: { phoneE164: { $type: "string" } } },
);
