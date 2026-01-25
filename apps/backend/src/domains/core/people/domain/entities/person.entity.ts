import { UserStatus } from "../value-objects";
import { MemberProfile } from "./member-profile.entity";

export interface PersonProps {
  id?: string;
  identityId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: Date;
  profilePicture?: string;
  status?: UserStatus;
  createdAt?: Date;
  updatedAt?: Date;
  profiles?: MemberProfile[];
}

export class Person {
  private props: PersonProps & {
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    profiles: MemberProfile[];
  };

  constructor(props: PersonProps) {
    this.props = {
      ...props,
      status: props.status ?? UserStatus.VALUE.ACTIVE,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
      profiles: props.profiles ?? [],
    };
  }

  get id(): string | undefined { return this.props.id; }
  get identityId(): string { return this.props.identityId; }
  get email(): string { return this.props.email; }
  get phone(): string | undefined { return this.props.phone; }
  get status(): UserStatus { return this.props.status; }
  get profilePicture(): string | undefined { return this.props.profilePicture; }
  
  get profiles(): MemberProfile[] { return this.props.profiles; }

  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName ?? ''}`.trim();
  }

  addProfile(profile: MemberProfile) {
    this.props.profiles.push(profile);
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
      status: this.props.status,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      // We do not include profiles here to avoid circular recursion loops 
      // if profiles also call back to Person. Handled separately in Mapper if needed.
    };
  }
}
