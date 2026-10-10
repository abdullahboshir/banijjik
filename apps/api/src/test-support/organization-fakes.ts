import { ORGANIZATION_STATUS } from "@banijjik/contracts";
import { newId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import type {
  ActorProfile,
  ActorProfileReader,
  RoleKeyLookup,
  SystemRoleProvisioner,
} from "../modules/core/organization/application/ports/iam-ports.js";
import type { MemberNumberSequence } from "../modules/core/organization/application/ports/member-number-sequence.js";
import type {
  LocationRepository,
  MemberRepository,
  OrganizationRepository,
} from "../modules/core/organization/application/ports/repositories.js";
import { SlugTakenError } from "../modules/core/organization/domain/errors.js";
import type { Location } from "../modules/core/organization/domain/location.entity.js";
import type { Member } from "../modules/core/organization/domain/member.entity.js";
import type { Organization } from "../modules/core/organization/domain/organization.entity.js";

export class InMemoryOrganizationRepository implements OrganizationRepository {
  readonly organizations = new Map<string, Organization>();
  findOpenByIdsCalls = 0;

  async insert(organization: Organization): Promise<void> {
    if (await this.isSlugTaken(organization.slug)) throw new SlugTakenError();
    this.organizations.set(organization.organizationId, organization);
  }

  async isSlugTaken(slug: string): Promise<boolean> {
    return [...this.organizations.values()].some((organization) => organization.slug === slug);
  }

  async findOpenByIds(organizationIds: readonly OrganizationId[]): Promise<Organization[]> {
    this.findOpenByIdsCalls += 1;
    return [...this.organizations.values()].filter(
      (organization) =>
        organizationIds.includes(organization.organizationId) &&
        organization.status !== ORGANIZATION_STATUS.CLOSED,
    );
  }
}

export class InMemoryLocationRepository implements LocationRepository {
  readonly locations: Location[] = [];

  async insert(location: Location): Promise<void> {
    this.locations.push(location);
  }
}

export class InMemoryMemberRepository implements MemberRepository {
  readonly members: Member[] = [];
  findActiveByUserIdCalls = 0;

  async insert(member: Member): Promise<void> {
    this.members.push(member);
  }

  async findActiveByUserId(userId: UserId, limit: number): Promise<Member[]> {
    this.findActiveByUserIdCalls += 1;
    return this.members
      .filter((member) => member.userId === userId && member.status === "ACTIVE")
      .slice(0, limit);
  }
}

/** Remembers every call and hands out a fresh owner role id, the way iam would. */
export class FakeSystemRoleProvisioner implements SystemRoleProvisioner {
  readonly calls: { organizationId: OrganizationId; actorUserId: UserId; ownerRoleId: RoleId }[] =
    [];

  async provision(
    organizationId: OrganizationId,
    actorUserId: UserId,
  ): Promise<{ ownerRoleId: RoleId }> {
    const ownerRoleId = newId() as RoleId;
    this.calls.push({ organizationId, actorUserId, ownerRoleId });
    return { ownerRoleId };
  }
}

export class InMemoryMemberNumberSequence implements MemberNumberSequence {
  calls = 0;

  async next(): Promise<number> {
    this.calls += 1;
    return this.calls;
  }
}

export class FakeActorProfileReader implements ActorProfileReader {
  readonly profiles = new Map<string, ActorProfile>();

  async findProfile(userId: UserId): Promise<ActorProfile | undefined> {
    return this.profiles.get(userId);
  }
}

export class FakeRoleKeyLookup implements RoleKeyLookup {
  readonly keysByRoleId = new Map<RoleId, string>();
  calls = 0;

  async findRoleKeysByIds(): Promise<ReadonlyMap<RoleId, string>> {
    this.calls += 1;
    return this.keysByRoleId;
  }
}
