import { PersonModel } from "./person.model";
import { PersonMapper } from "./person.mapper";
export class MongoosePersonRepository {
    async save(person) {
        const personData = PersonMapper.toPersonPersistence(person);
        if (person.personId) {
            await PersonModel.findByIdAndUpdate(person.personId, personData);
        }
        else {
            await PersonModel.create(personData);
        }
    }
    async findById(personId) {
        const doc = await PersonModel.findById(personId);
        return doc ? PersonMapper.toPersonDomain(doc) : null;
    }
    async findByUserId(userId) {
        const doc = await PersonModel.findOne({ userId });
        return doc ? PersonMapper.toPersonDomain(doc) : null;
    }
    async findByEmail(email) {
        const doc = await PersonModel.findOne({ email });
        return doc ? PersonMapper.toPersonDomain(doc) : null;
    }
}
//# sourceMappingURL=person.repository.impl.js.map