import { PeopleRepository, Person } from "@people/domain";
import { JoinOrganizationDto } from "../dto";
import { ConflictError } from "@shared";
import { ProfileResponseDto } from "@banijjik/contracts";
import { UserStatus } from "../../domain/value-objects/user-status.vo";

export class JoinOrganizationUseCase {
  constructor(private readonly peopleRepository: PeopleRepository) {}

  async execute(dto: JoinOrganizationDto): Promise<ProfileResponseDto> {
    // 1. Find or Create Person
    let person = await this.peopleRepository.findByIdentityId(dto.identityId);

    if (!person) {
      person = new Person({
        identityId: dto.identityId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        status: UserStatus.VALUE.ACTIVE,
        // New Person has no profiles initially
      });
      await this.peopleRepository.save(person);
      // Re-fetch to get generated ID if repository doesn't return instance with ID (depends on impl)
      // Usually save() mutates or we return from save. Assuming save() void, we might need ID.
      // If repo implementation generates ID on insert, person.id might be undefined unless Mongoose implementation sets it.
      // Defensively re-fetching is safer for now.
      person = await this.peopleRepository.findByIdentityId(dto.identityId);
    }

    if (!person || !person.id) {
      throw new Error("Failed to create or find person");
    }

    // 2. Check if already a member (Dynamic Attribute Check)
    // We use organizationId as the key for the profile data
    const existingProfileData = person.profileAttributes?.[dto.organizationId];

    if (existingProfileData) {
      throw new ConflictError(
        "Person is already a member of this organization",
      );
    }

    // 3. Create the Contextual Profile Data (Dynamic)
    // Note: status here is strictly for the JSON attribute, we can store string or VO value.
    // Storing string is safer for JSON serialization.
    const profileData = {
      type: dto.type,
      metadata: dto.metadata || {},
      status: UserStatus.VALUE.ACTIVE.getValue(),
      joinedAt: new Date().toISOString(),
    };

    // 4. Update Person Aggregate
    person.updateProfileAttribute(dto.organizationId, profileData);

    // 5. Save Aggregate
    await this.peopleRepository.save(person);

    // 6. Return Response
    // We construct the response based on the data we just saved.
    // The "id" of the profile is virtually the organizationId in this context,
    // or we can generate a surrogate ID if the frontend strictly needs one,
    // but semantically, a person has ONE profile per Org.

    return {
      id: `${person.id}_${dto.organizationId}`, // Surrogate ID for frontend keying
      type: profileData.type?.toString() || "",
      organizationId: dto.organizationId,
      status: profileData.status.toString(),
      joinedAt: profileData.joinedAt,
      metadata: profileData.metadata,
      person: {
        id: person.id,
        fullName: person.fullName,
        email: person.email,
      },
    };
  }
}
