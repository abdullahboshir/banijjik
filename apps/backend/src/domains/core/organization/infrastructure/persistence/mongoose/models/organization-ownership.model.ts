import {
  OWNERSHIP_STATUS,
  OWNERSHIP_STATUS_ENUM,
  OwnershipStatusType,
} from "@banijjik/contracts";
import { Schema, model, Document } from "mongoose";

export interface IOrganizationOwnershipDoc extends Document {
  ownershipId: string;
  organizationId: string;
  userId: string;
  legalAcceptedAt: Date;
  termsVersion: string;
  taxIdentifier?: string;
  billingEmail: string;
  billingPhone?: string;
  accountRecoveryEmail?: string;
  accountRecoveryPhone?: string;
  transferredFrom?: string;
  transferredAt?: Date;
  status: OwnershipStatusType;
}

const OrganizationOwnershipSchema = new Schema<IOrganizationOwnershipDoc>(
  {
    ownershipId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    legalAcceptedAt: { type: Date, required: true },
    termsVersion: { type: String, required: true },
    taxIdentifier: { type: String },
    billingEmail: { type: String, required: true },
    billingPhone: { type: String },
    accountRecoveryEmail: { type: String },
    accountRecoveryPhone: { type: String },
    transferredFrom: { type: String },
    transferredAt: { type: Date },
    status: {
      type: String,
      enum: OWNERSHIP_STATUS_ENUM,
      default: OWNERSHIP_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual for populating Organization
OrganizationOwnershipSchema.virtual("organization", {
  ref: "Organization",
  localField: "organizationId",
  foreignField: "organizationId",
  justOne: true,
});

// Virtual for populating User
OrganizationOwnershipSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "userId",
  justOne: true,
});

export const OrganizationOwnershipModel = model<IOrganizationOwnershipDoc>(
  "OrganizationOwnership",
  OrganizationOwnershipSchema,
);
