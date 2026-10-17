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
import type { CustomFieldSearchEntry, StoredCustomFields } from "./custom-field-values.js";
import { invalidField, invalidTransition } from "./errors.js";
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
  readonly jobTitle: string | undefined;
  /** From the organization's MEMBER sequence; formatting is a settings concern (card 2.4). */
  readonly employeeNumber: string | undefined;
  /** The staff profile values (NID, blood group, ...), validated against the member fields (ADR-107). */
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly CustomFieldSearchEntry[];
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

/** The fields `PATCH /members/{memberId}` may change. */
export interface MemberChanges {
  readonly displayName?: string;
  readonly jobTitle?: string;
  readonly assignments?: readonly Assignment[];
  /** The merged values and search entries, already validated against the member fields. */
  readonly customFields?: StoredCustomFields;
}

export interface RejoinInput {
  readonly displayName: string;
  readonly assignments: readonly Assignment[];
  readonly now: Date;
}

/** At least one assignment, none twice, and "ALL" never next to a specific location. */
export function assertAssignmentsAreConsistent(assignments: readonly Assignment[]): void {
  if (assignments.length === 0) throw invalidField("assignments", "validation.too_small");
  const locationIds = assignments.map((assignment) => assignment.locationId);
  const hasDuplicate = new Set(locationIds).size !== locationIds.length;
  // ALL already covers every location, so it cannot sit next to a specific one.
  const mixesAllWithSpecific = locationIds.includes(ALL_LOCATIONS) && locationIds.length > 1;
  if (hasDuplicate || mixesAllWithSpecific) {
    throw invalidField("assignments", "validation.invalid_value");
  }
}

function trimmedDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) throw invalidField("displayName", "validation.too_small");
  return trimmed;
}

/** A user's staff membership in one organization (09 section 4.4). */
export class Member implements MemberProps {
  readonly memberId: MemberId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly status: MemberStatus;
  readonly assignments: readonly Assignment[];
  readonly displayName: string;
  readonly jobTitle: string | undefined;
  readonly employeeNumber: string | undefined;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly customFieldSearch: readonly CustomFieldSearchEntry[];
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
    this.jobTitle = props.jobTitle;
    this.employeeNumber = props.employeeNumber;
    this.customFields = props.customFields;
    this.customFieldSearch = props.customFieldSearch;
    this.joinedAt = props.joinedAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
  }

  /** A member who is active from the start, as the owner of a new organization is. */
  static joinActive(input: NewActiveMemberInput): Member {
    const displayName = trimmedDisplayName(input.displayName);
    assertAssignmentsAreConsistent(input.assignments);
    return new Member({
      memberId: newId(),
      organizationId: input.organizationId,
      userId: input.userId,
      status: MEMBER_STATUS.ACTIVE,
      assignments: input.assignments,
      displayName,
      jobTitle: undefined,
      employeeNumber: input.employeeNumber,
      customFields: {},
      customFieldSearch: [],
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

  /** The member with the given changes. A removed member is history and cannot be edited. */
  withChanges(changes: MemberChanges): Member {
    if (this.status === MEMBER_STATUS.REMOVED) throw invalidTransition(this.status);
    const assignments = changes.assignments ?? this.assignments;
    assertAssignmentsAreConsistent(assignments);
    return new Member({
      ...this,
      displayName:
        changes.displayName === undefined
          ? this.displayName
          : trimmedDisplayName(changes.displayName),
      jobTitle: changes.jobTitle ?? this.jobTitle,
      assignments,
      customFields: changes.customFields?.values ?? this.customFields,
      customFieldSearch: changes.customFields?.search ?? this.customFieldSearch,
    });
  }

  suspend(): Member {
    return this.transition([MEMBER_STATUS.ACTIVE], MEMBER_STATUS.SUSPENDED);
  }

  reactivate(): Member {
    return this.transition([MEMBER_STATUS.SUSPENDED], MEMBER_STATUS.ACTIVE);
  }

  /** The record stays (REMOVED), because requests reference `memberId`. */
  remove(): Member {
    return this.transition([MEMBER_STATUS.ACTIVE, MEMBER_STATUS.SUSPENDED], MEMBER_STATUS.REMOVED);
  }

  /** A removed member who accepts a new invitation comes back as the same record. */
  rejoin(input: RejoinInput): Member {
    if (this.status !== MEMBER_STATUS.REMOVED) throw invalidTransition(this.status);
    assertAssignmentsAreConsistent(input.assignments);
    return new Member({
      ...this,
      status: MEMBER_STATUS.ACTIVE,
      displayName: trimmedDisplayName(input.displayName),
      assignments: input.assignments,
      joinedAt: input.now,
    });
  }

  private transition(allowedFrom: readonly MemberStatus[], to: MemberStatus): Member {
    if (!allowedFrom.includes(this.status)) throw invalidTransition(this.status);
    return new Member({ ...this, status: to });
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
