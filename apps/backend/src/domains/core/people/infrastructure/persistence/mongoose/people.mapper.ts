import {
  Person,
  MemberProfile,
  ProfileType,
  UserStatus,
} from "../../../domain";
import { IPersonDoc, IMemberProfileDoc } from "./people.model";

export class PeopleMapper {
  public static toPersonDomain(doc: IPersonDoc): Person {
    return new Person({
      id: doc._id.toString(),
      identityId: doc.identityId,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      phone: doc.phone,
      gender: doc.gender as any,
      dateOfBirth: doc.dateOfBirth,
      profilePicture: doc.profilePicture,
      status: UserStatus.from(doc.status),
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    });
  }

  public static toMemberProfileDomain(doc: IMemberProfileDoc): MemberProfile {
    return new MemberProfile({
      id: doc._id.toString(),
      personId: doc.personId.toString(),
      organizationId: doc.organizationId,
      type: ProfileType.from(doc.type),
      metadata: doc.metadata,
      status: doc.status as any,
      joinedAt: doc.joinedAt,
    });
  }

  public static toPersonPersistence(person: Person) {
    const primitives = person.toPrimitives();
    const personData = {
      identityId: primitives.identityId,
      firstName: primitives.firstName,
      lastName: primitives.lastName,
      email: primitives.email,
      phone: primitives.phone,
      gender: primitives.gender,
      dateOfBirth: primitives.dateOfBirth,
      profilePicture: primitives.profilePicture,
      status: primitives.status,
    };

    const profilesData = person.profiles.map((profile) =>
      this.toMemberProfilePersistence(profile),
    );

    return {
      person: personData,
      profiles: profilesData,
    };
  }

  public static toMemberProfilePersistence(profile: MemberProfile): any {
    const primitives = profile.toPrimitives();
    return {
      personId: primitives.personId,
      organizationId: primitives.organizationId,
      type: primitives.type.getValue(),
      metadata: primitives.metadata,
      status: primitives.status,
      joinedAt: primitives.joinedAt,
    };
  }
}
