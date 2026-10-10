import { ALL_LOCATIONS, SYSTEM_ROLE_KEY, type IndustryTemplateKey } from "@banijjik/contracts";
import type { RoleId, UserId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { sessionNotValid, SlugTakenError } from "../../domain/errors.js";
import { Location } from "../../domain/location.entity.js";
import { Member } from "../../domain/member.entity.js";
import { Organization } from "../../domain/organization.entity.js";
import type { MyOrganization } from "../my-organization.js";
import type {
  ActorProfile,
  ActorProfileReader,
  SystemRoleProvisioner,
} from "../ports/iam-ports.js";
import type { MemberNumberSequence } from "../ports/member-number-sequence.js";
import type {
  LocationRepository,
  MemberRepository,
  OrganizationRepository,
} from "../ports/repositories.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface CreateOrganizationInput {
  readonly actorUserId: UserId;
  readonly name: string;
  readonly slug: string;
  readonly industryTemplateKey: IndustryTemplateKey;
  readonly district: string | undefined;
}

export interface CreateOrganizationDependencies {
  readonly organizations: OrganizationRepository;
  readonly locations: LocationRepository;
  readonly members: MemberRepository;
  readonly systemRoles: SystemRoleProvisioner;
  readonly actorProfiles: ActorProfileReader;
  readonly memberNumbers: MemberNumberSequence;
  readonly unitOfWork: UnitOfWork;
  readonly clock: Clock;
}

/**
 * Creates a business: the organization, its six system roles, its default location and the owner
 * member, all in one transaction (09 section 4.2). The MEMBER number is taken before the
 * transaction (FAST sequence, ADR-085): an abort loses the number, it never repeats it.
 */
export class CreateOrganizationUseCase {
  constructor(private readonly dependencies: CreateOrganizationDependencies) {}

  async execute(input: CreateOrganizationInput): Promise<MyOrganization> {
    const { organizations, memberNumbers, clock } = this.dependencies;
    const actor = await this.readActor(input.actorUserId);
    const organization = Organization.create({
      name: input.name,
      slug: input.slug,
      industryTemplateKey: input.industryTemplateKey,
      ownerUserId: input.actorUserId,
      defaultLocale: actor.preferredLocale,
      now: clock.now(),
    });
    // A taken slug answers before a member number is spent; the unique index still decides races.
    if (await organizations.isSlugTaken(organization.slug)) throw new SlugTakenError();
    const memberNumber = await memberNumbers.next(organization.organizationId);
    await this.dependencies.unitOfWork.run(() =>
      this.storeAll(organization, { actor, district: input.district, memberNumber }),
    );
    return {
      organizationId: organization.organizationId,
      slug: organization.slug,
      name: organization.name,
      status: organization.status,
      roleKeys: [SYSTEM_ROLE_KEY.OWNER],
    };
  }

  private async readActor(userId: UserId): Promise<ActorProfile> {
    const profile = await this.dependencies.actorProfiles.findProfile(userId);
    if (profile === undefined) throw sessionNotValid();
    return profile;
  }

  /** Order matters only for readability: the organization first, then what hangs off it. */
  private async storeAll(
    organization: Organization,
    extras: { actor: ActorProfile; district: string | undefined; memberNumber: number },
  ): Promise<void> {
    const { organizations, locations, members, systemRoles } = this.dependencies;
    const { ownerUserId, organizationId } = organization;
    await organizations.insert(organization);
    const { ownerRoleId } = await systemRoles.provision(organizationId, ownerUserId);
    const location = Location.createDefault({
      organizationId,
      name: organization.name,
      district: extras.district,
      createdByUserId: ownerUserId,
      now: organization.createdAt,
    });
    await locations.insert(location);
    const owner = this.buildOwner(organization, ownerRoleId, extras);
    owner.assertLocationsAreActive([location]);
    await members.insert(owner);
  }

  private buildOwner(
    organization: Organization,
    ownerRoleId: RoleId,
    extras: { actor: ActorProfile; memberNumber: number },
  ): Member {
    return Member.joinActive({
      organizationId: organization.organizationId,
      userId: organization.ownerUserId,
      displayName: extras.actor.name,
      assignments: [{ locationId: ALL_LOCATIONS, roleId: ownerRoleId }],
      employeeNumber: String(extras.memberNumber),
      createdByUserId: organization.ownerUserId,
      now: organization.createdAt,
    });
  }
}
