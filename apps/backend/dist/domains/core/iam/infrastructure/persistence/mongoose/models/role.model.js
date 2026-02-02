import { PERMISSION_SCOPE } from "@banijjik/contracts";
import { Schema, model } from "mongoose";
// ═══════════════════════════════════════════════════════════════
// Role Schema
// ═══════════════════════════════════════════════════════════════
const RoleSchema = new Schema({
    roleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },
    permissions: [{ type: String, ref: "Permission" }],
    permissionGroups: [{ type: String, ref: "PermissionGroup" }],
    isSystem: { type: Boolean, default: false },
    roleScope: {
        type: String,
        enum: Object.values(PERMISSION_SCOPE),
        required: true,
        index: true,
    },
    isActive: { type: Boolean, default: true },
    hierarchyLevel: { type: Number, required: true, default: 1 },
    organizationId: {
        type: String,
        default: null,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Virtual for permissions populate support
RoleSchema.virtual("permissionDetails", {
    ref: "Permission",
    localField: "permissions",
    foreignField: "permissionId",
});
RoleSchema.index({ name: 1, roleScope: 1 }, { unique: true });
export const RoleModel = model("Role", RoleSchema);
//# sourceMappingURL=role.model.js.map