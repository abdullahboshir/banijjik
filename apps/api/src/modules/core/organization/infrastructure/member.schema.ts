import { MEMBER_STATUS, type MemberStatus } from "@banijjik/contracts";
import { Schema } from "mongoose";
import type { CustomFieldSearchEntry } from "../domain/custom-field-values.js";
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
  jobTitle?: string;
  employeeNumber?: string;
  /** Missing on members created before card 2.7a: read as no values. */
  customFields?: Record<string, unknown>;
  customFieldSearch?: CustomFieldSearchEntry[];
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

const customFieldSearchSchema = new Schema<CustomFieldSearchEntry>(
  {
    fieldKey: { type: String, required: true },
    value: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const memberSchema = new Schema<MemberDocument>(
  {
    ...domainIdField("memberId"),
    organizationId: { type: String, required: true, immutable: true },
    userId: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(MEMBER_STATUS) },
    assignments: { type: [assignmentSchema], default: [] },
    displayName: { type: String, required: true },
    jobTitle: { type: String },
    employeeNumber: { type: String },
    customFields: { type: Schema.Types.Mixed },
    customFieldSearch: { type: [customFieldSearchSchema] },
    joinedAt: { type: Date, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

memberSchema.index({ organizationId: 1, memberId: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
// "Is any ACTIVE member assigned to this location?" (location archive) and the member list.
memberSchema.index({ organizationId: 1, status: 1, "assignments.locationId": 1 });
memberSchema.index({ organizationId: 1, status: 1, displayName: 1 });
// Finds members by a searchable custom field value (attribute pattern, ADR-102 and ADR-107).
memberSchema.index({
  organizationId: 1,
  "customFieldSearch.fieldKey": 1,
  "customFieldSearch.value": 1,
});
// Lists the organizations of one user (GET /me/orgs).
memberSchema.index({ userId: 1, status: 1 });
