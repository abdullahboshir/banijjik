import { Document, Types } from "mongoose";
import { MEMBERSHIP_TYPE_ENUM, MEMBERSHIP_SOURCE_ENUM } from "@banijjik/contracts";
export interface IOrganizationMembershipDoc extends Document {
    userId: string;
    organizationId: string;
    roleId: string;
    type: (typeof MEMBERSHIP_TYPE_ENUM)[number];
    designation?: string;
    memberCode?: string;
    status: string;
    source: (typeof MEMBERSHIP_SOURCE_ENUM)[number];
    joinedAt: Date;
    metadata?: Record<string, any>;
}
export declare const OrganizationMembershipModel: import("mongoose").Model<IOrganizationMembershipDoc, {}, {}, {}, Document<unknown, {}, IOrganizationMembershipDoc, {}, {}> & IOrganizationMembershipDoc & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=organization-membership.model.d.ts.map