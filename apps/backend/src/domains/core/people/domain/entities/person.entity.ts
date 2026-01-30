import { UserStatus } from "../value-objects/user-status.vo";

export interface PersonProps {
  id?: string;
  identityId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: Date;
  profilePicture?: string;
  designation?: string;
  status?: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
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

  get id(): string | undefined {
    return this.props.id;
  }
  get identityId(): string {
    return this.props.identityId;
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
      id: this.props.id,
      identityId: this.props.identityId,
      firstName: this.props.firstName,
      lastName: this.props.lastName,
      email: this.props.email,
      phone: this.props.phone,
      gender: this.props.gender,
      dateOfBirth: this.props.dateOfBirth,
      profilePicture: this.props.profilePicture,
      designation: this.props.designation,
      status: this.props.status,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      profileAttributes: this.props.profileAttributes,
    };
  }
}
