import {
  ALL_LOCATIONS,
  MEMBER_STATUS,
  type AllLocations,
  type MemberStatus,
} from "@banijjik/contracts";
import {
  newId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { invalidField } from "./errors.js";
import type { Location } from "./location.entity.js";

/** "This member has this role at this location, or at ALL locations" (ADR-005). */
export interface Assignment {
  readonly locationId: LocationId | AllLocations;
  readonly roleId: RoleId;
}

export interface MemberProps {
  readonly memberId: MemberId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly status: MemberStatus;
  readonly assignments: readonly Assignment[];
  readonly displayName: string;
  /** From the organization's MEMBER sequence; formatting is a settings concern (card 2.4). */
  readonly employeeNumber: string | undefined;
  readonly joinedAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;
}

export interface NewActiveMemberInput {
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly displayName: string;
  readonly assignments: readonly Assignment[];
  readonly employeeNumber: string | undefined;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;
  readonly now: Date;
}

function assertAssignmentsAreConsistent(assignments: readonly Assignment[]): void {
  if (assignments.length === 0) throw invalidField("assignments", "validation.too_small");
  const locationIds = assignments.map((assignment) => assignment.locationId);
  const hasDuplicate = new Set(locationIds).size !== locationIds.length;
  // ALL already covers every location, so it cannot sit next to a specific one.
  const mixesAllWithSpecific = locationIds.includes(ALL_LOCATIONS) && locationIds.length > 1;
  if (hasDuplicate || mixesAllWithSpecific) {
    throw invalidField("assignments", "validation.invalid_value");
  }
}

/** A user's staff membership in one organization (09 section 4.4). */
export class Member implements MemberProps {
  readonly memberId: MemberId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly status: MemberStatus;
  readonly assignments: readonly Assignment[];
  readonly displayName: string;
  readonly employeeNumber: string | undefined;
  readonly joinedAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Null when the system created it. */
  readonly createdByUserId: UserId | null;

  private constructor(props: MemberProps) {
    this.memberId = props.memberId;
    this.organizationId = props.organizationId;
    this.userId = props.userId;
    this.status = props.status;
    this.assignments = props.assignments;
    this.displayName = props.displayName;
    this.employeeNumber = props.employeeNumber;
    this.joinedAt = props.joinedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  /** A member who is active from the start, as the owner of a new organization is. */
  static joinActive(input: NewActiveMemberInput): Member {
    const displayName = input.displayName.trim();
    if (displayName.length === 0) throw invalidField("displayName", "validation.too_small");
    assertAssignmentsAreConsistent(input.assignments);
    return new Member({
      memberId: newId(),
      organizationId: input.organizationId,
      userId: input.userId,
      status: MEMBER_STATUS.ACTIVE,
      assignments: input.assignments,
      displayName,
      employeeNumber: input.employeeNumber,
      joinedAt: input.now,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.createdByUserId,
    });
  }

  /** Rebuilds a stored member. The stored data was checked when it was written. */
  static restore(props: MemberProps): Member {
    return new Member(props);
  }

  /**
   * Every location named in an assignment must be an ACTIVE location of the same organization
   * (09 section 4.4). "ALL" names no location and needs no check.
   */
  assertLocationsAreActive(locations: readonly Location[]): void {
    for (const assignment of this.assignments) {
      if (assignment.locationId === ALL_LOCATIONS) continue;
      const location = locations.find(
        (candidate) => candidate.locationId === assignment.locationId,
      );
      const isUsable =
        location !== undefined &&
        location.organizationId === this.organizationId &&
        location.isActive();
      if (!isUsable) throw invalidField("assignments", "validation.invalid_value");
    }
  }
}
