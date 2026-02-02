import { PersonRepository } from "@person/domain";
import { Person } from "@person/domain";
export declare class MongoosePersonRepository implements PersonRepository {
    save(person: Person): Promise<void>;
    findById(personId: string): Promise<Person | null>;
    findByUserId(userId: string): Promise<Person | null>;
    findByEmail(email: string): Promise<Person | null>;
}
//# sourceMappingURL=person.repository.impl.d.ts.map