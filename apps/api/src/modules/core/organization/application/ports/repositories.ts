import type { OrganizationId, UserId } from "@banijjik/ids";
import type { Location } from "../../domain/location.entity.js";
import type { Member } from "../../domain/member.entity.js";
import type { Organization } from "../../domain/organization.entity.js";

export interface OrganizationRepository {
  /** Throws SlugTakenError when the slug is taken, including by a concurrent insert. */
  insert(organization: Organization): Promise<void>;
  isSlugTaken(slug: string): Promise<boolean>;
  /** Organizations that are not CLOSED, for the given IDs, in one query. */
  findOpenByIds(organizationIds: readonly OrganizationId[]): Promise<Organization[]>;
}

export interface LocationRepository {
  insert(location: Location): Promise<void>;
}

export interface MemberRepository {
  insert(member: Member): Promise<void>;
  /** The ACTIVE memberships of a user across organizations, at most `limit`, in one query. */
  findActiveByUserId(userId: UserId, limit: number): Promise<Member[]>;
}
