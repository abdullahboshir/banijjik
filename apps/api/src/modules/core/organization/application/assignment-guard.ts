import { ALL_LOCATIONS } from "@banijjik/contracts";
import type { RoleId } from "@banijjik/ids";
import type { PermissionGate } from "../../../../kernel/access/index.js";
import {
  assertAssignmentsAreConsistent,
  assertCallerHoldsEveryKey,
  assertEveryLocationIsActive,
  assertRolesAreAssignable,
  holdsEveryKey,
  keysHeldBy,
  type RoleGrants,
} from "../domain/assignment-rules.js";
import type { Assignment } from "../domain/member.entity.js";
import type { RoleGrantLookup } from "./ports/iam-ports.js";
import type { LocationManagementRepository } from "./ports/location-management-repository.js";

export interface AssignmentGuardDependencies {
  readonly roles: RoleGrantLookup;
  readonly locations: Pick<LocationManagementRepository, "touchActive">;
  /** The caller's own grants of the current request, from the kernel permission gate. */
  readonly permissions: Pick<PermissionGate, "describeCaller">;
}

/**
 * The rules every assignment change goes through (ADR-092): the list is consistent, its locations
 * are ACTIVE, its roles are ACTIVE and not the OWNER role, and the caller holds every permission
 * of every role they give or take away, so nobody can raise their own or a friend's access above
 * what they hold. Run inside the transaction of the change.
 */
export class AssignmentGuard {
  constructor(private readonly dependencies: AssignmentGuardDependencies) {}

  /** For a role set that is given to a member: the full set of rules. */
  async assertCanGrant(assignments: readonly Assignment[]): Promise<void> {
    await this.assertAssignable(assignments);
    await this.assertCallerHolds(assignments);
  }

  /** For an invitation that is accepted: the caller is the invitee, so only the state rules apply. */
  async assertAssignable(assignments: readonly Assignment[]): Promise<void> {
    const { locations } = this.dependencies;
    assertAssignmentsAreConsistent(assignments);
    const locationIds = [
      ...new Set(
        assignments.flatMap(({ locationId }) => (locationId === ALL_LOCATIONS ? [] : [locationId])),
      ),
    ];
    // Touching the locations is what serializes this change against an archive of the same location.
    assertEveryLocationIsActive(locationIds.length, await locations.touchActive(locationIds));
    assertRolesAreAssignable(assignments, await this.grantsOf(assignments));
  }

  /** For roles that are taken away, or a member who is suspended, reactivated or removed. */
  async assertCallerHolds(assignments: readonly Assignment[]): Promise<void> {
    if (assignments.length === 0) return;
    const caller = await this.dependencies.permissions.describeCaller();
    assertCallerHoldsEveryKey(assignments, await this.grantsOf(assignments), caller);
  }

  /**
   * For an invitation that is accepted: does the inviter still hold every key of every invited role
   * at the invited locations? A yes or no, because the answer decides whether the invitation lives.
   */
  async holderMayGrant(
    holder: readonly Assignment[],
    assignments: readonly Assignment[],
  ): Promise<boolean> {
    const grants = await this.grantsOf([...holder, ...assignments]);
    return holdsEveryKey(assignments, grants, keysHeldBy(holder, grants));
  }

  private grantsOf(assignments: readonly Assignment[]): Promise<RoleGrants> {
    const roleIds: RoleId[] = assignments.map(({ roleId }) => roleId);
    return this.dependencies.roles.findGrants(roleIds);
  }
}
