import { PERMISSION_EFFECT, PERMISSION_DOMAIN_ENUM } from "@banijjik/contracts";
import { model, Schema } from "mongoose";
// ═══════════════════════════════════════════════════════════════
// Permission Group Schema
// ═══════════════════════════════════════════════════════════════
const PermissionGroupSchema = new Schema({
    permissionGroupId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: { type: String, required: true, trim: true, unique: true },
    domain: {
        type: String,
        required: true,
        enum: PERMISSION_DOMAIN_ENUM,
    },
    description: { type: String, required: true },
    permissions: [{ type: String, ref: "Permission", required: true }],
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// Virtual for permissions populate support using String IDs
PermissionGroupSchema.virtual("permissionDetails", {
    ref: "Permission",
    localField: "permissions",
    foreignField: "permissionId",
});
PermissionGroupSchema.index({ domain: 1 });
export const PermissionGroupModel = model("PermissionGroup", PermissionGroupSchema);
//# sourceMappingURL=permission-group.model.js.map