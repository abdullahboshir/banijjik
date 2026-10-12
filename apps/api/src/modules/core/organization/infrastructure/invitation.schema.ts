import { INVITATION_STATUS, type InvitationStatus } from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { AssignmentDocument } from "./member.schema.js";

export const INVITATION_MODEL_NAME = "Invitation";
export const INVITATION_COLLECTION_NAME = "invitations";

export interface InvitationDocument {
  invitationId: string;
  organizationId: string;
  email?: string;
  phoneE164?: string;
  displayName?: string;
  assignments: AssignmentDocument[];
  invitedByUserId: string;
  tokenHash: string;
  expiresAt: Date;
  status: InvitationStatus;
  acceptedByUserId?: string;
  acceptedAt?: Date;
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

export const invitationSchema = new Schema<InvitationDocument>(
  {
    ...domainIdField("invitationId"),
    organizationId: { type: String, required: true, immutable: true },
    email: { type: String },
    phoneE164: { type: String },
    displayName: { type: String },
    assignments: { type: [assignmentSchema], default: [] },
    invitedByUserId: { type: String, required: true },
    tokenHash: { type: String, required: true, immutable: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, required: true, enum: Object.values(INVITATION_STATUS) },
    acceptedByUserId: { type: String },
    acceptedAt: { type: Date },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

invitationSchema.index({ organizationId: 1, invitationId: 1 }, { unique: true });
// The list endpoint and the pending count filter by status.
invitationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
// A member who loses access takes their pending invitations with them.
invitationSchema.index({ organizationId: 1, invitedByUserId: 1, status: 1 });
// The public preview and accept look an invitation up by the hash of its token.
invitationSchema.index({ tokenHash: 1 }, { unique: true });
