import { Schema, model, Document, Types } from "mongoose";
import {
  COMMON_STATUS,
  MEMBERSHIP_TYPE_ENUM,
  MEMBERSHIP_TYPE,
  MEMBERSHIP_SOURCE_ENUM,
  MEMBERSHIP_SOURCE,
} from "@banijjik/contracts";

export interface IOrganizationMembershipDoc extends Document {
  userId: string;
  organizationId: string;
  roleId: string;
  type: (typeof MEMBERSHIP_TYPE_ENUM)[number];
  designation?: string;
  memberCode?: string;
  status: string;
  source: (typeof MEMBERSHIP_SOURCE_ENUM)[number];
  joinedAt: Date;
  metadata?: Record<string, any>;
}

const OrganizationMembershipSchema = new Schema<IOrganizationMembershipDoc>(
  {
    userId: { type: String, required: true, index: true },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    roleId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: MEMBERSHIP_TYPE_ENUM,
      default: MEMBERSHIP_TYPE.STAFF,
      required: true,
    },
    designation: { type: String, trim: true },
    memberCode: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(COMMON_STATUS),
      default: COMMON_STATUS.ACTIVE,
    },
    source: {
      type: String,
      enum: MEMBERSHIP_SOURCE_ENUM,
      default: MEMBERSHIP_SOURCE.MANUAL_ADD,
    },
    joinedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtuals for Populate support using String IDs
OrganizationMembershipSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "userId",
  justOne: true,
});

OrganizationMembershipSchema.virtual("organization", {
  ref: "Organization",
  localField: "organizationId",
  foreignField: "organizationId",
  justOne: true,
});

OrganizationMembershipSchema.virtual("role", {
  ref: "Role",
  localField: "roleId",
  foreignField: "roleId",
  justOne: true,
});

OrganizationMembershipSchema.index(
  { userId: 1, organizationId: 1, roleId: 1 },
  { unique: true },
);

export const OrganizationMembershipModel = model<IOrganizationMembershipDoc>(
  "OrganizationMembership",
  OrganizationMembershipSchema,
);
