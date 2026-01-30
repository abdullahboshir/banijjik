import { Schema, model, Document } from "mongoose";

export interface IPersonDoc extends Document {
  identityId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  profileType: string;
  designation?: string;
  gender?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  status: string;
  // Dynamic Attributes Pattern
  profileAttributes: Record<string, any>;
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
    // Key-Value Store for Dynamic Profile Data
    profileAttributes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const PersonModel = model<IPersonDoc>("Person", PersonSchema);
