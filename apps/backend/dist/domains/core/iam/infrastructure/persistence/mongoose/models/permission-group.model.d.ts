import { Document, Types } from "mongoose";
export interface IPermissionGroupDoc extends Document {
    permissionGroupId: string;
    name: string;
    domain: string;
    description: string;
    permissions: string[];
    resolver: {
        strategy: string;
        priority: number;
        inheritFrom: string[];
        override: boolean;
        fallback: string;
    };
    isActive: boolean;
}
export declare const PermissionGroupModel: import("mongoose").Model<IPermissionGroupDoc, {}, {}, {}, Document<unknown, {}, IPermissionGroupDoc, {}, {}> & IPermissionGroupDoc & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=permission-group.model.d.ts.map