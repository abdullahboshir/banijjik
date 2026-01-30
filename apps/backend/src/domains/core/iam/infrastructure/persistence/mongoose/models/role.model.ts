import { Schema, model, Document, Types } from "mongoose";

export interface IRoleDoc extends Document {
  name: string;
  key: string;
  organizationId?: Types.ObjectId;
  permissions: Types.ObjectId[];
  isSystem: boolean;
}

const RoleSchema = new Schema<IRoleDoc>(
  {
    name: { type: String, required: true },
    key: { type: String, required: true },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    permissions: [{ type: Schema.Types.ObjectId, ref: "Permission" }],
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Compound index to ensure keys are unique within an organization (or platform-wide if null)
RoleSchema.index({ key: 1, organizationId: 1 }, { unique: true });

export const RoleModel = model<IRoleDoc>("Role", RoleSchema);
