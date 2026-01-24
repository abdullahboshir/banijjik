import { Person } from '../entities/person.entity';
import { MemberProfile } from '../entities/member-profile.entity';

export interface PersonRepository {
  save(person: Person): Promise<void>;

  findById(id: string): Promise<Person | null>;
  findByIdentityId(identityId: string): Promise<Person | null>;
  findByEmail(email: string): Promise<Person | null>;

  // Aggregate-level queries
  findProfilesByPerson(personId: string): Promise<MemberProfile[]>;
  findProfileByOrg(
    personId: string,
    organizationId: string
  ): Promise<MemberProfile | null>;
}
