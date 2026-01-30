import { Person } from "../entities/person.entity";

export interface PeopleRepository {
  save(person: Person): Promise<void>;

  findById(id: string): Promise<Person | null>;
  findByIdentityId(identityId: string): Promise<Person | null>;
  findByEmail(email: string): Promise<Person | null>;
}
