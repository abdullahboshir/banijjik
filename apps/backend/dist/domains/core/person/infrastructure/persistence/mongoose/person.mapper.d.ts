import { Person } from "../../../domain";
import { IPersonDoc } from "./person.model";
export declare class PersonMapper {
    static toPersonDomain(doc: IPersonDoc): Person;
    static toPersonPersistence(person: Person): {
        personId: string;
        userId: string;
        firstName: string;
        lastName: string | undefined;
        email: string;
        phone: string | undefined;
        gender: "male" | "female" | "other" | undefined;
        dateOfBirth: Date | undefined;
        profilePicture: string | undefined;
        status: "PENDING" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "BLOCKED" | "DELETED";
        bloodGroup: string | undefined;
        fatherName: string | undefined;
        motherName: string | undefined;
        emergencyContact: string | undefined;
        nid: string | undefined;
        permanentAddress: string | undefined;
        currentAddress: string | undefined;
        profileAttributes: Record<string, any>;
    };
}
//# sourceMappingURL=person.mapper.d.ts.map