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
  /**
   * [UNIVERSAL] Dynamic Attributes
   * Stores global personal data valid across ALL organizations.
   * Examples: `religion`, `hobbies`, `social_links`.
   * NOT for context-specific data like `roll_no`.
   */
  profileAttributes?: Record<string, any>;
}

export class Person {
  private props: PersonProps & {
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    profileAttributes: Record<string, any>;
  };

  constructor(props: PersonProps) {
    this.props = {
      ...props,
      status: props.status ?? UserStatus.VALUE.ACTIVE,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
      profileAttributes: props.profileAttributes ?? {},
    };
  }

  get _id(): string | undefined {
    return this.props._id;
  }
  get id(): string | undefined {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get email(): string {
    return this.props.email;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get profilePicture(): string | undefined {
    return this.props.profilePicture;
  }
  get designation(): string | undefined {
    return this.props.designation;
  }

  get bloodGroup(): string | undefined {
    return this.props.bloodGroup;
  }
  get fatherName(): string | undefined {
    return this.props.fatherName;
  }
  get motherName(): string | undefined {
    return this.props.motherName;
  }
  get emergencyContact(): string | undefined {
    return this.props.emergencyContact;
  }
  get nid(): string | undefined {
    return this.props.nid;
  }

  get profileAttributes(): Record<string, any> {
    return this.props.profileAttributes;
  }

  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName ?? ""}`.trim();
  }

  /**
   * updateProfileAttribute
   * Dynamically updates a specific attribute for a business profile.
   * key: "weight" | "class"
   */
  updateProfileAttribute(key: string, value: any) {
    this.props.profileAttributes[key] = value;
    this.touch();
  }

  changeName(firstName: string, lastName?: string) {
    this.props.firstName = firstName;
    this.props.lastName = lastName;
    this.touch();
  }

  private touch() {
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
