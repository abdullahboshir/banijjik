import { PeopleRepository } from "@people/domain";
import { Person, MemberProfile } from "@people/domain";
import { PersonModel, MemberProfileModel } from "./people.model";
import { PeopleMapper } from "./people.mapper";

export class MongoosePeopleImplRepository implements PeopleRepository {
  async save(person: Person): Promise<void> {
    const { person: personData } = PeopleMapper.toPersonPersistence(person);

    if (person.id) {
      await PersonModel.findByIdAndUpdate(person.id, personData);
    } else {
      await PersonModel.create(personData);
    }

    // Manage Aggregate: MemberProfiles
    for (const profile of person.profiles) {
      const profileData = PeopleMapper.toMemberProfilePersistence(profile);
      if (profile.id) {
        await MemberProfileModel.findByIdAndUpdate(profile.id, profileData);
      } else {
        await MemberProfileModel.create(profileData);
      }
    }
  }

  async findById(id: string): Promise<Person | null> {
    const doc = await PersonModel.findById(id);
    return doc ? PeopleMapper.toPersonDomain(doc) : null;
  }

  async findByIdentityId(identityId: string): Promise<Person | null> {
    const doc = await PersonModel.findOne({ identityId });
    return doc ? PeopleMapper.toPersonDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<Person | null> {
    const doc = await PersonModel.findOne({ email });
    return doc ? PeopleMapper.toPersonDomain(doc) : null;
  }

  // Aggregate-level MemberProfile methods
  async findProfilesByPerson(personId: string): Promise<MemberProfile[]> {
    const docs = await MemberProfileModel.find({ personId });
    return docs.map((doc) => PeopleMapper.toMemberProfileDomain(doc));
  }

  async findProfileByOrg(
    personId: string,
    organizationId: string,
  ): Promise<MemberProfile | null> {
    const doc = await MemberProfileModel.findOne({ personId, organizationId });
    return doc ? PeopleMapper.toMemberProfileDomain(doc) : null;
  }
}
