import {
  PLATFORM_ROLE,
  USER_STATUS,
  type PlatformRole,
  type UserStatus,
} from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const PLATFORM_OPERATOR_MODEL_NAME = "PlatformOperator";
export const PLATFORM_OPERATOR_COLLECTION_NAME = "platform_operators";

export interface PlatformOperatorDocument {
  platformOperatorId: string;
  userId: string;
  platformRoles: PlatformRole[];
  status: UserStatus;
  version: number;
  referenceVersion?: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const platformOperatorSchema = new Schema<PlatformOperatorDocument>(
  {
    ...domainIdField("platformOperatorId"),
    userId: { type: String, required: true },
    platformRoles: [{ type: String, enum: Object.values(PLATFORM_ROLE), required: true }],
    status: { type: String, required: true, enum: Object.values(USER_STATUS) },
    ...versionField,
    referenceVersion: { type: Number, default: 0 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

platformOperatorSchema.index({ platformOperatorId: 1 }, { unique: true });
platformOperatorSchema.index({ userId: 1 }, { unique: true });
platformOperatorSchema.index({ status: 1, createdAt: -1, platformOperatorId: -1 });
