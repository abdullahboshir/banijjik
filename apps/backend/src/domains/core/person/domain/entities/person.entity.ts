import { UserStatus } from "../value-objects/user-status.vo";
import { IndustryBlueprint } from "../value-objects/industry-blueprint.vo";
import { OrganizationIndustry } from "../value-objects/organization-industry.vo";

export interface PersonProps {
  personId: string;
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

  get personId(): string {
    return this.props.personId;
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

  /**
   * Helper to get typed profile attributes
   * Usage: person.getTypedProfileAttributes<CoachingProfileAttributes>()
   */
  getTypedProfileAttributes<T>(): T {
    return this.props.profileAttributes as T;
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

  /**
   * Validates dynamic profile attributes against the industry blueprint.
   * STRICT Domain Rule: Checks if required fields exist.
   * @throws Error if required fields are missing
   */
  validateIndustryAttributes(industry: string): void {
    // Validate industry type using VO
    if (!OrganizationIndustry.isValid(industry)) return;

    const blueprint = IndustryBlueprint.get(industry);
    if (!blueprint) return;

    const missingFields: string[] = [];
    const attributes = this.props.profileAttributes || {};

    for (const field of blueprint) {
      if (
        field.required &&
        (attributes[field.key] === undefined || attributes[field.key] === null)
      ) {
        missingFields.push(field.label);
      }
    }

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required profile fields for ${industry}: ${missingFields.join(
          ", ",
        )}`,
      );
    }
  }

  private touch() {
    this.props.updatedAt = new Date();
  }

  toPrimitives() {
    return {
      personId: this.props.personId,
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

  static create(props: PersonProps): Person {
    return new Person(props);
  }
}
