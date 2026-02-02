import { PERMISSION_EFFECT, PERMISSION_SCOPE, PERMISSION_DOMAIN_ENUM, } from "@banijjik/contracts";
import { Schema, model } from "mongoose";
// ═══════════════════════════════════════════════════════════════
// Permission Schema
// ═══════════════════════════════════════════════════════════════
const PermissionSchema = new Schema({
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
}, { timestamps: true });
PermissionSchema.index({ resource: 1, action: 1 });
PermissionSchema.index({ domain: 1 });
export const PermissionModel = model("Permission", PermissionSchema);
//# sourceMappingURL=permission.model.js.map