import { Person } from "../entities/person.entity";

export interface PersonRepository {
  save(person: Person): Promise<void>;

  findById(personId: string): Promise<Person | null>;
  findByUserId(userId: string): Promise<Person | null>;
  findByEmail(email: string): Promise<Person | null>;
}
