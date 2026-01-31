import { PERMISSION_SCOPE } from "@banijjik/contracts";
import { Schema, model } from "mongoose";
// ═══════════════════════════════════════════════════════════════
// Role Schema
// ═══════════════════════════════════════════════════════════════
const RoleSchema = new Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    permissions: [{ type: Schema.Types.ObjectId, ref: "Permission" }],
    permissionGroups: [{ type: Schema.Types.ObjectId, ref: "PermissionGroup" }],
    isSystemRole: { type: Boolean, default: false },
    roleScope: {
        type: String,
        enum: Object.values(PERMISSION_SCOPE),
        required: true,
        index: true,
    },
    isActive: { type: Boolean, default: true },
    hierarchyLevel: { type: Number, required: true, default: 1 },
    organization: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        default: null,
        index: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
RoleSchema.index({ name: 1, roleScope: 1 }, { unique: true });
export const RoleModel = model("Role", RoleSchema);
//# sourceMappingURL=role.model.js.map