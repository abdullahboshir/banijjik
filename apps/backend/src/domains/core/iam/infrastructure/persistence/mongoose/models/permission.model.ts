import {
  PERMISSION_EFFECT,
  PERMISSION_SCOPE,
  PERMISSION_DOMAIN_ENUM,
} from "@banijjik/contracts";
import { Schema, model, Document, Types } from "mongoose";

// ═══════════════════════════════════════════════════════════════
// Permission Document Interface
// ═══════════════════════════════════════════════════════════════
export interface IPermissionDoc extends Document {
  permissionId: string;
  domain: string; // Bounded context (iam, organization, billing) - for sidebar grouping
  resource: string;
  action: string;
  scope: string;
  effect: string;
  description: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
}

// ═══════════════════════════════════════════════════════════════
// Permission Schema
// ═══════════════════════════════════════════════════════════════
const PermissionSchema = new Schema<IPermissionDoc>(
  {
    permissionId: { type: String, required: true, unique: true },
    domain: {
      type: String,
      required: true,
      enum: PERMISSION_DOMAIN_ENUM,
    },
    resource: { type: String, required: true },
    action: { type: String, required: true },
    scope: {
      type: String,
      enum: Object.values(PERMISSION_SCOPE),
      required: true,
    },
    effect: {
      type: String,
      enum: Object.values(PERMISSION_EFFECT),
      default: PERMISSION_EFFECT.ALLOW,
    },
    description: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

PermissionSchema.index({ resource: 1, action: 1 });
PermissionSchema.index({ domain: 1 });

export const PermissionModel = model<IPermissionDoc>(
  "Permission",
  PermissionSchema,
);
