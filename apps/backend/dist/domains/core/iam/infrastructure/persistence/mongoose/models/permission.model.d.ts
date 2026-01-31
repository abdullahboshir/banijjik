import { Document, Types } from "mongoose";
export interface IPermissionDoc extends Document {
    id: string;
    domain: string;
    resource: string;
    action: string;
    scope: string;
    effect: string;
    description: string;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}
export declare const PermissionModel: import("mongoose").Model<IPermissionDoc, {}, {}, {}, Document<unknown, {}, IPermissionDoc, {}, {}> & IPermissionDoc & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=permission.model.d.ts.map