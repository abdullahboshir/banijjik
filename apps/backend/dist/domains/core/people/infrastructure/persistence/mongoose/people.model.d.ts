import { Document } from "mongoose";
export interface IPersonDoc extends Document {
    userId: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    profileType: string;
    designation?: string;
    gender?: string;
    dateOfBirth?: Date;
    profilePicture?: string;
    status: string;
    profileAttributes: Record<string, any>;
}
export declare const PersonModel: import("mongoose").Model<IPersonDoc, {}, {}, {}, Document<unknown, {}, IPersonDoc, {}, {}> & IPersonDoc & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=people.model.d.ts.map