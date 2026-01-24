import mongoose, { Schema, Document } from 'mongoose';
import { UserStatus } from '@identity/domain';

export interface IUserDocument extends Omit<Document, '_id'> {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string | null;
  password: string | null;
  needsPasswordChange: boolean;
  passwordChangedAt: Date | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  status: UserStatus;
  isActive: boolean;
  isDeleted: boolean;
  isSuperAdmin: boolean;
  globalRoles: string[];
  directPermissions: any[];
  businessAccess: any[];
  lastLogin: Date | null;
  loginHistory: any[];
  settings: any;
  metadata: any;
  organization?: string;
  region?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    _id: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    password: { type: String, default: null },
    needsPasswordChange: { type: Boolean, default: false },
    passwordChangedAt: { type: Date, default: null },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.PENDING },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    globalRoles: [{ type: String }],
    directPermissions: [{ type: Schema.Types.Mixed }],
    businessAccess: [{ type: Schema.Types.Mixed }],
    lastLogin: { type: Date, default: null },
    loginHistory: [{ type: Schema.Types.Mixed }],
    settings: { type: Schema.Types.Mixed, default: {} },
    metadata: { type: Schema.Types.Mixed, default: {} },
    organization: { type: String, index: true },
    region: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  {
    timestamps: true,
    _id: false, // We use string IDs
  }
);

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);
