import { Schema, model } from "mongoose";
import { COMMON_STATUS, MEMBERSHIP_TYPE_ENUM, MEMBERSHIP_TYPE, MEMBERSHIP_SOURCE_ENUM, MEMBERSHIP_SOURCE, } from "@banijjik/contracts";
const OrganizationMembershipSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: "Organization",
        required: true,
    },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    type: {
        type: String,
        enum: MEMBERSHIP_TYPE_ENUM,
        default: MEMBERSHIP_TYPE.STAFF,
        required: true,
    },
    designation: { type: String, trim: true },
    memberCode: { type: String, trim: true },
    status: {
        type: String,
        enum: Object.values(COMMON_STATUS),
        default: COMMON_STATUS.ACTIVE,
    },
    source: {
        type: String,
        enum: MEMBERSHIP_SOURCE_ENUM,
        default: MEMBERSHIP_SOURCE.MANUAL_ADD,
    },
    joinedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Map, of: Schema.Types.Mixed },
}, { timestamps: true });
OrganizationMembershipSchema.index({ userId: 1, organizationId: 1, roleId: 1 }, { unique: true });
export const OrganizationMembershipModel = model("OrganizationMembership", OrganizationMembershipSchema);
//# sourceMappingURL=organization-membership.model.js.map