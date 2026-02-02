import mongoose, { Schema, Document } from "mongoose";
import {
  UserStatusType,
  USER_STATUS,
  IUserLastActiveContext,
} from "@banijjik/contracts";

export interface IUserDocument extends Document {
  userId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string | null;
  password: string | null;
  needsPasswordChange: boolean;
  passwordChangedAt: Date | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: UserStatusType;
  isActive: boolean;
  isDeleted: boolean;
  isSuperAdmin: boolean;
  systemRoles: string[];
  directPermissions: any[];
  lastLogin: Date | null;
  lastActiveContext?: IUserLastActiveContext;
  loginHistory: any[];
  settings: any;
  metadata: any;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, default: null },
    password: { type: String, default: null },
    needsPasswordChange: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    systemRoles: [{ type: String }],
    directPermissions: [{ type: Schema.Types.Mixed }],
    lastLogin: { type: Date, default: null },
    lastActiveContext: {
      portal: { type: String, required: true }, // PLATFORM | ORGANIZATION | CONSUMER
      organizationId: { type: String },
      roleId: { type: String },

      // New Context Fields
      activeProfileType: { type: String }, // e.g. GUARDIAN
      activeIndustryType: { type: String }, // e.g. COACHING

      profileId: { type: String },
      lastAccessedAt: { type: Date, default: null },
    },
    loginHistory: [{ type: Schema.Types.Mixed }],
    settings: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
  },
);

export const UserModel = mongoose.model<IUserDocument>("User", UserSchema);
