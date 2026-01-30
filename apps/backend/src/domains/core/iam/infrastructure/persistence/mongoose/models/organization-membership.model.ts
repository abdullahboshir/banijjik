import { Schema, model, Document, Types } from "mongoose";
import { COMMON_STATUS } from "@banijjik/contracts";

export interface IOrganizationMembershipDoc extends Document {
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  roleId: Types.ObjectId;
  status: string;
  joinedAt: Date;
  metadata?: Record<string, any>;
}

const OrganizationMembershipSchema = new Schema<IOrganizationMembershipDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    status: {
      type: String,
      enum: Object.values(COMMON_STATUS),
      default: COMMON_STATUS.ACTIVE,
    },
    joinedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed },
  },
  { timestamps: true },
);

OrganizationMembershipSchema.index(
  { userId: 1, organizationId: 1, roleId: 1 },
  { unique: true },
);

export const OrganizationMembershipModel = model<IOrganizationMembershipDoc>(
  "OrganizationMembership",
  OrganizationMembershipSchema,
);
