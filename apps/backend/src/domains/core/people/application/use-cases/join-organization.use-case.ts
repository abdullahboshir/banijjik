import { PeopleRepository, Person, MemberProfile } from "@people/domain";
import { JoinOrganizationDto } from "../dto";
import { ConflictError } from "@shared";
import { ProfileResponseDto, USER_STATUS } from "@banijjik/contracts";

export class JoinOrganizationUseCase {
  constructor(private readonly peopleRepository: PeopleRepository) {}

  async execute(dto: JoinOrganizationDto): Promise<ProfileResponseDto> {
    let person = await this.peopleRepository.findByIdentityId(dto.identityId);

    if (!person) {
      person = new Person({
        identityId: dto.identityId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        status: USER_STATUS.ACTIVE,
      });
      await this.peopleRepository.save(person);
      person = await this.peopleRepository.findByIdentityId(dto.identityId);
    }

    if (!person || !person.id) {
      throw new Error("Failed to create or find person");
    }

    const existingProfile = await this.peopleRepository.findProfileByOrg(
      person.id,
      dto.organizationId,
    );

    if (existingProfile) {
      throw new ConflictError(
        "Person is already a member of this organization",
      );
    }

    // 3. Create the Contextual Profile
    const profile = new MemberProfile({
      personId: person.id,
      organizationId: dto.organizationId,
      type: dto.type as any, // Mapper handles strict validation
      metadata: dto.metadata,
      status: USER_STATUS.ACTIVE,
      joinedAt: new Date(),
    });

    person.addProfile(profile);
    await this.peopleRepository.save(person);

    return {
      id: (profile as any).id || "",
      type: profile.type.toString(),
      organizationId: profile.organizationId,
      status: profile.status.toString(),
      joinedAt: profile.joinedAt.toISOString(),
      metadata: profile.metadata,
      person: {
        id: person.id,
        fullName: person.fullName,
        email: person.email,
      },
    };
  }
}
