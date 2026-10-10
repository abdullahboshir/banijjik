import type { LocationStatus } from "@banijjik/contracts";
import type { LocationId, OrganizationId, UserId } from "@banijjik/ids";
import type { Location } from "../../domain/location.entity.js";
import type { Organization } from "../../domain/organization.entity.js";

export interface PageRequest {
  readonly page: number;
  readonly limit: number;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly hasNext: boolean;
}

/** Reads and saves the business profile. Organizations are platform data: no tenant filter exists. */
export interface OrganizationProfileRepository {
  findById(organizationId: OrganizationId): Promise<Organization | undefined>;
  /** Saves name, locale and profile if the stored version is still `expectedVersion`, else a 409. */
  update(
    organization: Organization,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Organization>;
}

export interface LocationListRequest extends PageRequest {
  readonly status?: LocationStatus;
  /** The locations the caller may see; "ALL" shows every location (plan 1.7b decision 5). */
  readonly visibleLocationIds: readonly string[] | "ALL";
}

/** Locations of the active organization; the tenant plugin scopes every query. */
export interface LocationManagementRepository {
  /** Throws DuplicateFieldError("name") when an ACTIVE location has the name. Joins the unit of work. */
  insert(location: Location): Promise<void>;
  findById(locationId: LocationId): Promise<Location | undefined>;
  /** The ACTIVE ones among the given IDs, in one query. */
  findActiveByIds(locationIds: readonly LocationId[]): Promise<readonly Location[]>;
  list(request: LocationListRequest): Promise<Page<Location>>;
  countActive(): Promise<number>;
  /** Throws DuplicateFieldError("name") on a name clash; a stale version is a 409. */
  update(location: Location, expectedVersion: number, actorUserId: UserId): Promise<Location>;
}
