import type { MemberStatus } from "@banijjik/contracts";
import type { LocationId, MemberId, UserId } from "@banijjik/ids";
import type { Member } from "../../domain/member.entity.js";
import type { Reach } from "../../domain/reach.js";
import type { Page, PageRequest } from "./page.js";

export interface MemberListRequest extends PageRequest {
  readonly status?: MemberStatus;
  /** Case-insensitive part of the display name. */
  readonly search?: string;
  /** Only members whose every assignment is inside this reach are listed (the filter runs in the query). */
  readonly reach: Reach;
}

/** Members of the active organization; the tenant plugin scopes every query. */
export interface MemberManagementRepository {
  insert(member: Member): Promise<void>;
  findById(memberId: MemberId): Promise<Member | undefined>;
  findByUserId(userId: UserId): Promise<Member | undefined>;
  list(request: MemberListRequest): Promise<Page<Member>>;
  countActive(): Promise<number>;
  /** True when an ACTIVE member holds a role at this location. */
  existsActiveAssignedTo(locationId: LocationId): Promise<boolean>;
  /** Saves display name, job title, assignments and status if the version is current, else a 409. */
  update(member: Member, expectedVersion: number, actorUserId: UserId): Promise<Member>;
}
