import { ALL_LOCATIONS } from "@banijjik/contracts";
import type { RoleId } from "@banijjik/ids";
import { invalidField, roleNotGrantable } from "./errors.js";
import { assertAssignmentsAreConsistent, type Assignment } from "./member.entity.js";

/** What the organization module needs to know about a role before it is handed to someone. */
export interface RoleGrant {
  readonly roleId: RoleId;
  /** An ARCHIVED role grants nothing and cannot be assigned. */
  readonly isActive: boolean;
  /** The OWNER system role: only ownership transfer moves it (ADR-046). */
  readonly isOwnerRole: boolean;
  readonly permissionKeys: ReadonlySet<string>;
}

/** The permission keys the caller holds, by where they are granted (same shape as the kernel's CallerGrants). */
export interface CallerKeys {
  readonly allLocations: readonly string[];
  readonly byLocation: Readonly<Record<string, readonly string[]>>;
}

export type RoleGrants = ReadonlyMap<RoleId, RoleGrant>;

/** The number of ACTIVE locations found must equal the number of distinct locations named. */
export function assertEveryLocationIsActive(named: number, found: number): void {
  if (found !== named) throw invalidField("assignments", "validation.invalid_value");
}

/**
 * Each role must exist in the organization, be ACTIVE, and not be the OWNER role. An unknown ID
 * and a role of another organization look the same, so nothing is revealed (ADR-080).
 */
export function assertRolesAreAssignable(
  assignments: readonly Assignment[],
  grants: RoleGrants,
): void {
  for (const { roleId } of assignments) {
    const grant = grants.get(roleId);
    if (grant === undefined || !grant.isActive || grant.isOwnerRole) throw roleNotGrantable(roleId);
  }
}

function callerHolds(caller: CallerKeys, locationId: string, key: string): boolean {
  if (caller.allLocations.includes(key)) return true;
  // A role given at "ALL" needs the key at ALL; a role at one location needs it there or at ALL.
  if (locationId === ALL_LOCATIONS) return false;
  return caller.byLocation[locationId]?.includes(key) ?? false;
}

function firstUngrantedRole(
  assignments: readonly Assignment[],
  grants: RoleGrants,
  caller: CallerKeys,
): RoleId | undefined {
  for (const { locationId, roleId } of assignments) {
    const keys = grants.get(roleId)?.permissionKeys ?? new Set<string>();
    for (const key of keys) {
      if (!callerHolds(caller, locationId, key)) return roleId;
    }
  }
  return undefined;
}

/**
 * No privilege escalation (ADR-092): every permission key of every role in `assignments` must
 * already be held by the caller, at ALL or at that location. Run it for the roles being given
 * and for the roles being taken away, so nobody changes access they do not themselves hold.
 */
export function assertCallerHoldsEveryKey(
  assignments: readonly Assignment[],
  grants: RoleGrants,
  caller: CallerKeys,
): void {
  const ungranted = firstUngrantedRole(assignments, grants, caller);
  if (ungranted !== undefined) throw roleNotGrantable(ungranted);
}

/** The same rule as a yes or no, for a holder other than the caller (the inviter of an invitation). */
export function holdsEveryKey(
  assignments: readonly Assignment[],
  grants: RoleGrants,
  holder: CallerKeys,
): boolean {
  return firstUngrantedRole(assignments, grants, holder) === undefined;
}

/** What a member holds, by where: a role given at "ALL" counts everywhere, any other at its location. */
export function keysHeldBy(assignments: readonly Assignment[], grants: RoleGrants): CallerKeys {
  const allLocations = new Set<string>();
  const byLocation = new Map<string, Set<string>>();
  for (const { locationId, roleId } of assignments) {
    const keys = grants.get(roleId)?.permissionKeys ?? new Set<string>();
    if (locationId === ALL_LOCATIONS) {
      keys.forEach((key) => allLocations.add(key));
      continue;
    }
    const atLocation = byLocation.get(locationId) ?? new Set<string>();
    keys.forEach((key) => atLocation.add(key));
    byLocation.set(locationId, atLocation);
  }
  return {
    allLocations: [...allLocations],
    byLocation: Object.fromEntries([...byLocation].map(([id, keys]) => [id, [...keys]])),
  };
}

function sameAssignment(left: Assignment, right: Assignment): boolean {
  return left.locationId === right.locationId && left.roleId === right.roleId;
}

export interface AssignmentChange {
  readonly added: readonly Assignment[];
  readonly removed: readonly Assignment[];
}

export function diffAssignments(
  before: readonly Assignment[],
  after: readonly Assignment[],
): AssignmentChange {
  return {
    added: after.filter(
      (candidate) => !before.some((existing) => sameAssignment(existing, candidate)),
    ),
    removed: before.filter(
      (existing) => !after.some((candidate) => sameAssignment(existing, candidate)),
    ),
  };
}

export { assertAssignmentsAreConsistent };
