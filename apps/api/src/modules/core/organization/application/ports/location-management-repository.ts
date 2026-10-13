import type { LocationStatus } from "@banijjik/contracts";
import type { LocationId, UserId } from "@banijjik/ids";
import type { Location } from "../../domain/location.entity.js";
import type { PageRequest, Page } from "./page.js";

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
  /**
   * Writes a guard counter on each of the given ACTIVE locations and returns how many it found.
   * Anyone who gives a member or an invitation a role at a location calls this inside their
   * transaction; archiving writes the same document, so a concurrent pair conflicts and one of
   * them is retried and sees the other's result (ADR-092).
   */
  touchActive(locationIds: readonly LocationId[]): Promise<number>;
  list(request: LocationListRequest): Promise<Page<Location>>;
  countActive(): Promise<number>;
  /** Throws DuplicateFieldError("name") on a name clash; a stale version is a 409. */
  update(location: Location, expectedVersion: number, actorUserId: UserId): Promise<Location>;
}
