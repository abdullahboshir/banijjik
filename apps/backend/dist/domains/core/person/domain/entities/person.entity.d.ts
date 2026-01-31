import { UserStatus } from "../value-objects/user-status.vo";
export interface PersonProps {
    _id?: string;
    id?: string;
    userId: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    gender?: "male" | "female" | "other";
    dateOfBirth?: Date;
    profilePicture?: string;
    designation?: string;
    bloodGroup?: string;
    fatherName?: string;
    motherName?: string;
    emergencyContact?: string;
    nid?: string;
    permanentAddress?: string;
    currentAddress?: string;
    status?: UserStatus;
    createdAt?: Date;
    updatedAt?: Date;
    profileAttributes?: Record<string, any>;
}
export declare class Person {
    private props;
    constructor(props: PersonProps);
    get _id(): string | undefined;
    get id(): string | undefined;
    get userId(): string;
    get email(): string;
    get phone(): string | undefined;
    get status(): UserStatus;
    get profilePicture(): string | undefined;
    get designation(): string | undefined;
    get bloodGroup(): string | undefined;
    get fatherName(): string | undefined;
    get motherName(): string | undefined;
    get emergencyContact(): string | undefined;
    get nid(): string | undefined;
    get profileAttributes(): Record<string, any>;
    get fullName(): string;
    /**
     * updateProfileAttribute
     * Dynamically updates a specific attribute for a business profile.
     * key: "weight" | "class"
     */
    updateProfileAttribute(key: string, value: any): void;
    changeName(firstName: string, lastName?: string): void;
    private touch;
    toPrimitives(): {
        _id: string | undefined;
        id: string | undefined;
        userId: string;
        firstName: string;
        lastName: string | undefined;
        email: string;
        phone: string | undefined;
        gender: "male" | "female" | "other" | undefined;
        dateOfBirth: Date | undefined;
        profilePicture: string | undefined;
        designation: string | undefined;
        bloodGroup: string | undefined;
        fatherName: string | undefined;
        motherName: string | undefined;
        emergencyContact: string | undefined;
        nid: string | undefined;
        permanentAddress: string | undefined;
        currentAddress: string | undefined;
        status: UserStatus;
        createdAt: Date;
        updatedAt: Date;
        profileAttributes: Record<string, any>;
    };
}
//# sourceMappingURL=person.entity.d.ts.map