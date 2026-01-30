import { Person } from "../../../domain";
import { IPersonDoc } from "./people.model";
import { UserStatus } from "../../../domain/value-objects/user-status.vo";

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
      designation: doc.designation,
      status: UserStatus.from(doc.status),
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
      profileAttributes: doc.profileAttributes,
    });
  }

  public static toPersonPersistence(person: Person) {
    const primitives = person.toPrimitives();
    return {
      identityId: primitives.identityId,
      firstName: primitives.firstName,
      lastName: primitives.lastName,
      email: primitives.email,
      phone: primitives.phone,
      gender: primitives.gender,
      dateOfBirth: primitives.dateOfBirth,
      profilePicture: primitives.profilePicture,
      status: person.status.getValue(),
      profileAttributes: primitives.profileAttributes,
    };
  }
}
