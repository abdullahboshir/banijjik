import { Person } from "../../../domain";
import { IPersonDoc } from "./person.model";
import { UserStatus } from "../../../domain/value-objects/user-status.vo";

export class PersonMapper {
  public static toPersonDomain(doc: IPersonDoc): Person {
    return new Person({
      _id: doc._id.toString(),
      id: doc.id,
      userId: doc.userId,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      phone: doc.phone,
      gender: doc.gender as any,
      dateOfBirth: doc.dateOfBirth,
      profilePicture: doc.profilePicture,
      designation: doc.designation,
      bloodGroup: doc.bloodGroup,
      fatherName: doc.fatherName,
      motherName: doc.motherName,
      emergencyContact: doc.emergencyContact,
      nid: doc.nid,
      permanentAddress: doc.permanentAddress,
      currentAddress: doc.currentAddress,
      status: UserStatus.from(doc.status),
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
      profileAttributes: doc.profileAttributes,
    });
  }

  public static toPersonPersistence(person: Person) {
    const primitives = person.toPrimitives();
    return {
      _id: primitives._id,
      id: primitives.id,
      userId: primitives.userId,
      firstName: primitives.firstName,
      lastName: primitives.lastName,
      email: primitives.email,
      phone: primitives.phone,
      gender: primitives.gender,
      dateOfBirth: primitives.dateOfBirth,
      profilePicture: primitives.profilePicture,
      status: person.status.getValue(),
      bloodGroup: primitives.bloodGroup,
      fatherName: primitives.fatherName,
      motherName: primitives.motherName,
      emergencyContact: primitives.emergencyContact,
      nid: primitives.nid,
      permanentAddress: primitives.permanentAddress,
      currentAddress: primitives.currentAddress,
      profileAttributes: primitives.profileAttributes,
    };
  }
}
