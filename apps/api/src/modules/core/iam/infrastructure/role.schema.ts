import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const ROLE_MODEL_NAME = "Role";
export const ROLE_COLLECTION_NAME = "roles";

export interface RoleDocument {
  roleId: string;
  organizationId: string;
  roleKey: string;
  nameKey: string;
  isSystem: boolean;
  permissionKeys: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const roleSchema = new Schema<RoleDocument>(
  {
    ...domainIdField("roleId"),
    organizationId: { type: String, required: true },
    roleKey: { type: String, required: true },
    nameKey: { type: String, required: true },
    isSystem: { type: Boolean, required: true },
    permissionKeys: { type: [String], default: [] },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

roleSchema.index({ organizationId: 1, roleId: 1 }, { unique: true });
roleSchema.index({ organizationId: 1, roleKey: 1 }, { unique: true });
