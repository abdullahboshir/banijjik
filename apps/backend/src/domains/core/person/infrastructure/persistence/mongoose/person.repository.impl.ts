import { PersonRepository } from "@person/domain";
import { Person } from "@person/domain";
import { PersonModel } from "./person.model";
import { PersonMapper } from "./person.mapper";

export class MongoosePersonRepository implements PersonRepository {
  async save(person: Person): Promise<void> {
    const personData = PersonMapper.toPersonPersistence(person);

    if (person.personId) {
      await PersonModel.findOneAndUpdate(
        { personId: person.personId },
        personData,
        {
          upsert: true,
        },
      );
    } else {
      await PersonModel.create(personData);
    }
  }

  async findById(personId: string): Promise<Person | null> {
    const doc = await PersonModel.findOne({ personId });
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
