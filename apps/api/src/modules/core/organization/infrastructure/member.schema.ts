import { MEMBER_STATUS, type MemberStatus } from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const MEMBER_MODEL_NAME = "Member";
export const MEMBER_COLLECTION_NAME = "members";

export interface AssignmentDocument {
  locationId: string;
  roleId: string;
}

export interface MemberDocument {
  memberId: string;
  organizationId: string;
  userId: string;
  status: MemberStatus;
  assignments: AssignmentDocument[];
  displayName: string;
  employeeNumber?: string;
  joinedAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const assignmentSchema = new Schema<AssignmentDocument>(
  {
    locationId: { type: String, required: true },
    roleId: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const memberSchema = new Schema<MemberDocument>(
  {
    ...domainIdField("memberId"),
    organizationId: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(MEMBER_STATUS) },
    assignments: { type: [assignmentSchema], default: [] },
    displayName: { type: String, required: true },
    employeeNumber: { type: String },
    joinedAt: { type: Date, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

memberSchema.index({ organizationId: 1, memberId: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
// Lists the organizations of one user (GET /me/orgs).
memberSchema.index({ userId: 1, status: 1 });
