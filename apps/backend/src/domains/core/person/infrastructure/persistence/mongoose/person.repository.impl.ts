import { PersonRepository } from "@person/domain";
import { Person } from "@person/domain";
import { PersonModel } from "./person.model";
import { PersonMapper } from "./person.mapper";

export class MongoosePersonRepository implements PersonRepository {
  async save(person: Person): Promise<void> {
    const personData = PersonMapper.toPersonPersistence(person);

    if (person.id) {
      await PersonModel.findByIdAndUpdate(person.id, personData);
    } else {
      await PersonModel.create(personData);
    }
  }

  async findById(id: string): Promise<Person | null> {
    const doc = await PersonModel.findById(id);
    return doc ? PersonMapper.toPersonDomain(doc) : null;
  }

  async findByUserId(userId: string): Promise<Person | null> {
    const doc = await PersonModel.findOne({ userId });
    return doc ? PersonMapper.toPersonDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<Person | null> {
    const doc = await PersonModel.findOne({ email });
    return doc ? PersonMapper.toPersonDomain(doc) : null;
  }
}
