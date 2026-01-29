import { Schema, model, Document } from "mongoose";

export interface IPersonDoc extends Document {
  identityId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  status: string;
}

const PersonSchema = new Schema<IPersonDoc>(
  {
    identityId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    gender: { type: String },
    dateOfBirth: { type: Date },
    profilePicture: { type: String },
    status: { type: String, default: "active" },
  },
  { timestamps: true },
);

export const PersonModel = model<IPersonDoc>("Person", PersonSchema);

export interface IMemberProfileDoc extends Document {
  personId: Schema.Types.ObjectId;
  organizationId: string;
  type: string;
  metadata: Record<string, any>;
  status: string;
  joinedAt: Date;
}

const MemberProfileSchema = new Schema<IMemberProfileDoc>(
  {
    personId: { type: Schema.Types.ObjectId, ref: "Person", required: true },
    organizationId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Compound index for quick lookup of a person in an organization
MemberProfileSchema.index({ personId: 1, organizationId: 1 }, { unique: true });

export const MemberProfileModel = model<IMemberProfileDoc>(
  "MemberProfile",
  MemberProfileSchema,
);
