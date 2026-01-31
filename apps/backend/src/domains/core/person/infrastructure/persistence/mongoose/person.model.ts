import { Schema, model, Document } from "mongoose";

export interface IPersonDoc extends Document {
  id: string;
  userId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  profileType: string;
  designation?: string;
  gender?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  bloodGroup?: string;
  fatherName?: string;
  motherName?: string;
  emergencyContact?: string;
  nid?: string;
  permanentAddress?: string;
  currentAddress?: string;
  status: string;
  // Dynamic Attributes Pattern
  profileAttributes: Record<string, any>;
}

const PersonSchema = new Schema<IPersonDoc>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    gender: { type: String },
    dateOfBirth: { type: Date },
    profilePicture: { type: String },
    bloodGroup: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    emergencyContact: { type: String },
    nid: { type: String },
    permanentAddress: { type: String },
    currentAddress: { type: String },
    status: { type: String, default: "active" },
    // Key-Value Store for Dynamic Profile Data
    profileAttributes: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const PersonModel = model<IPersonDoc>("Person", PersonSchema);
