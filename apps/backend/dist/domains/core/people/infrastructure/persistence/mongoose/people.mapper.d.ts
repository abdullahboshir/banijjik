import { Person } from "../../../domain";
import { IPersonDoc } from "./people.model";
export declare class PeopleMapper {
    static toPersonDomain(doc: IPersonDoc): Person;
    static toPersonPersistence(person: Person): {
        identityId: any;
        firstName: string;
        lastName: string | undefined;
        email: string;
        phone: string | undefined;
        gender: "male" | "female" | "other" | undefined;
        dateOfBirth: Date | undefined;
        profilePicture: string | undefined;
        status: "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED" | "BLOCKED" | "DELETED";
        profileAttributes: Record<string, any>;
    };
}
//# sourceMappingURL=people.mapper.d.ts.map