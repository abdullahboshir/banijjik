import { Document, Types } from "mongoose";
export interface IRoleDoc extends Document {
    name: string;
    description: string;
    permissions: Types.ObjectId[];
    permissionGroups: Types.ObjectId[];
    isSystemRole: boolean;
    roleScope: string;
    isActive: boolean;
    hierarchyLevel: number;
    organization?: Types.ObjectId;
}
export declare const RoleModel: import("mongoose").Model<IRoleDoc, {}, {}, {}, Document<unknown, {}, IRoleDoc, {}, {}> & IRoleDoc & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=role.model.d.ts.map