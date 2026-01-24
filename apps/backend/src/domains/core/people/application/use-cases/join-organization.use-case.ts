import { PersonRepository, Person, MemberProfile } from '@people/domain';
import { JoinOrganizationDto, ProfileResponseDto } from '../dto';
import { ConflictError } from '@shared';

export class JoinOrganizationUseCase {
  constructor(
    private readonly personRepository: PersonRepository
  ) {}

  async execute(dto: JoinOrganizationDto): Promise<ProfileResponseDto> {
    // 1. Find or Create the Global Person
    let person = await this.personRepository.findByIdentityId(dto.identityId);
    
    if (!person) {
      person = new Person({
        identityId: dto.identityId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        status: 'active' as any,
      });
      await this.personRepository.save(person);
      // Re-fetch to get the ID
      person = await this.personRepository.findByIdentityId(dto.identityId);
    }

    if (!person || !person.id) {
      throw new Error('Failed to create or find person');
    }

    // 2. Check if profile already exists for this organization
    const existingProfile = await this.personRepository.findProfileByOrg(
      person.id,
      dto.organizationId
    );

    if (existingProfile) {
      throw new ConflictError('Person is already a member of this organization');
    }

    // 3. Create the Contextual Profile
    const profile = new MemberProfile({
      personId: person.id,
      organizationId: dto.organizationId,
      type: dto.type as any, // Mapper handles strict validation
      metadata: dto.metadata,
      status: 'active',
      joinedAt: new Date(),
    });

    person.addProfile(profile);
    await this.personRepository.save(person);

    return {
      id: (profile as any).id || '',
      type: profile.type.toString(),
      organizationId: profile.organizationId,
      status: profile.status,
      joinedAt: profile.joinedAt.toISOString(),
      metadata: profile.metadata,
      person: {
        id: person.id,
        fullName: person.fullName,
        email: person.email,
      }
    };
  }
}
