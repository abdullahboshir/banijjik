import { Document } from "mongoose";
export interface IPersonDoc extends Document {
    id: string;
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
    bloodGroup?: string;
    fatherName?: string;
    motherName?: string;
    emergencyContact?: string;
    nid?: string;
    permanentAddress?: string;
    currentAddress?: string;
    status: string;
    profileAttributes: Record<string, any>;
}
export declare const PersonModel: import("mongoose").Model<IPersonDoc, {}, {}, {}, Document<unknown, {}, IPersonDoc, {}, {}> & IPersonDoc & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=person.model.d.ts.map