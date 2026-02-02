import mongoose, { Document } from "mongoose";
import { UserStatusType, IUserLastActiveContext } from "@banijjik/contracts";
export interface IUserDocument extends Document {
    userId: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone: string | null;
    password: string | null;
    needsPasswordChange: boolean;
    passwordChangedAt: Date | null;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    status: UserStatusType;
    isActive: boolean;
    isDeleted: boolean;
    isSuperAdmin: boolean;
    systemRoles: string[];
    directPermissions: any[];
    lastLogin: Date | null;
    lastActiveContext?: IUserLastActiveContext;
    loginHistory: any[];
    settings: any;
    metadata: any;
    createdBy?: string;
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const UserModel: mongoose.Model<IUserDocument, {}, {}, {}, mongoose.Document<unknown, {}, IUserDocument, {}, {}> & IUserDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=user.model.d.ts.map