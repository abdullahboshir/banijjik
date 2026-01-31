import { PERMISSION_EFFECT, PERMISSION_DOMAIN_ENUM } from "@banijjik/contracts";
import { model, Schema, Document, Types } from "mongoose";

// ═══════════════════════════════════════════════════════════════
// Permission Group Document Interface
// ═══════════════════════════════════════════════════════════════
export interface IPermissionGroupDoc extends Document {
  name: string;
  domain: string; // Bounded context - for sidebar grouping
  description: string;
  permissions: Types.ObjectId[];
  resolver: {
    strategy: string;
    priority: number;
    inheritFrom: string[];
    override: boolean;
    fallback: string;
  };
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Permission Group Schema
// ═══════════════════════════════════════════════════════════════
const PermissionGroupSchema = new Schema<IPermissionGroupDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    domain: {
      type: String,
      required: true,
      enum: PERMISSION_DOMAIN_ENUM,
    },
    description: { type: String, required: true },
    permissions: [
      { type: Schema.Types.ObjectId, ref: "Permission", required: true },
    ],
    resolver: {
      strategy: { type: String, required: true },
      priority: { type: Number, default: 0 },
      inheritFrom: [{ type: String }],
      override: { type: Boolean, default: false },
      fallback: {
        type: String,
        enum: Object.values(PERMISSION_EFFECT),
        default: PERMISSION_EFFECT.DENY,
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PermissionGroupSchema.index({ domain: 1 });

export const PermissionGroupModel = model<IPermissionGroupDoc>(
  "PermissionGroup",
  PermissionGroupSchema,
);
