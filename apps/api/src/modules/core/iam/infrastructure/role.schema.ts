import { ROLE_STATUS, type RoleStatus } from "@banijjik/contracts";
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
  nameKey: string | null;
  name: string | null;
  isSystem: boolean;
  status: RoleStatus;
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
    organizationId: { type: String, required: true, immutable: true },
    roleKey: { type: String, required: true },
    nameKey: { type: String, default: null },
    name: { type: String, default: null },
    isSystem: { type: Boolean, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(ROLE_STATUS),
      default: ROLE_STATUS.ACTIVE,
    },
    permissionKeys: { type: [String], default: [] },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

roleSchema.index({ organizationId: 1, roleId: 1 }, { unique: true });
roleSchema.index({ organizationId: 1, roleKey: 1 }, { unique: true });
// A custom role name is unique among the ACTIVE roles; an archived role frees its name.
roleSchema.index(
  { organizationId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ROLE_STATUS.ACTIVE, name: { $type: "string" } },
  },
);
// Backs GET /roles: system roles first (in creation order), then custom roles by name.
roleSchema.index({ organizationId: 1, isSystem: -1, name: 1, roleId: 1 });
