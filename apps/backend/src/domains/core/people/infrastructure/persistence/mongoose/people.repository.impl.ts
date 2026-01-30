import { PeopleRepository } from "@people/domain";
import { Person } from "@people/domain";
import { PersonModel } from "./people.model";
import { PeopleMapper } from "./people.mapper";

export class MongoosePeopleImplRepository implements PeopleRepository {
  async save(person: Person): Promise<void> {
    const personData = PeopleMapper.toPersonPersistence(person);

    if (person.id) {
      await PersonModel.findByIdAndUpdate(person.id, personData);
    } else {
      await PersonModel.create(personData);
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
}
