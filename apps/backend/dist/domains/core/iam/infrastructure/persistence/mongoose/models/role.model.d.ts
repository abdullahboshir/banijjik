import { Document, Types } from "mongoose";
export interface IRoleDoc extends Document {
    roleId: string;
    name: string;
    key: string;
    description: string;
    permissions: string[];
    permissionGroups: string[];
    isSystem: boolean;
    roleScope: string;
    isActive: boolean;
    hierarchyLevel: number;
    organizationId?: string;
}
export declare const RoleModel: import("mongoose").Model<IRoleDoc, {}, {}, {}, Document<unknown, {}, IRoleDoc, {}, {}> & IRoleDoc & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=role.model.d.ts.map