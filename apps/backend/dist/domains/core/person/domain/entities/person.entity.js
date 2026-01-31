import { UserStatus } from "../value-objects/user-status.vo";
export class Person {
    constructor(props) {
        this.props = {
            ...props,
            status: props.status ?? UserStatus.VALUE.ACTIVE,
            createdAt: props.createdAt ?? new Date(),
            updatedAt: props.updatedAt ?? new Date(),
            profileAttributes: props.profileAttributes ?? {},
        };
    }
    get _id() {
        return this.props._id;
    }
    get id() {
        return this.props.id;
    }
    get userId() {
        return this.props.userId;
    }
    get email() {
        return this.props.email;
    }
    get phone() {
        return this.props.phone;
    }
    get status() {
        return this.props.status;
    }
    get profilePicture() {
        return this.props.profilePicture;
    }
    get designation() {
        return this.props.designation;
    }
    get bloodGroup() {
        return this.props.bloodGroup;
    }
    get fatherName() {
        return this.props.fatherName;
    }
    get motherName() {
        return this.props.motherName;
    }
    get emergencyContact() {
        return this.props.emergencyContact;
    }
    get nid() {
        return this.props.nid;
    }
    get profileAttributes() {
        return this.props.profileAttributes;
    }
    get fullName() {
        return `${this.props.firstName} ${this.props.lastName ?? ""}`.trim();
    }
    /**
     * updateProfileAttribute
     * Dynamically updates a specific attribute for a business profile.
     * key: "weight" | "class"
     */
    updateProfileAttribute(key, value) {
        this.props.profileAttributes[key] = value;
        this.touch();
    }
    changeName(firstName, lastName) {
        this.props.firstName = firstName;
        this.props.lastName = lastName;
        this.touch();
    }
    touch() {
        this.props.updatedAt = new Date();
    }
    toPrimitives() {
        return {
            _id: this.props._id,
            id: this.props.id,
            userId: this.props.userId,
            firstName: this.props.firstName,
            lastName: this.props.lastName,
            email: this.props.email,
            phone: this.props.phone,
            gender: this.props.gender,
            dateOfBirth: this.props.dateOfBirth,
            profilePicture: this.props.profilePicture,
            designation: this.props.designation,
            bloodGroup: this.props.bloodGroup,
            fatherName: this.props.fatherName,
            motherName: this.props.motherName,
            emergencyContact: this.props.emergencyContact,
            nid: this.props.nid,
            permanentAddress: this.props.permanentAddress,
            currentAddress: this.props.currentAddress,
            status: this.props.status,
            createdAt: this.props.createdAt,
            updatedAt: this.props.updatedAt,
            profileAttributes: this.props.profileAttributes,
        };
    }
}
//# sourceMappingURL=person.entity.js.map