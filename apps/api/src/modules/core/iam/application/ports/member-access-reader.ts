import type { RoleId } from "@banijjik/ids";

export interface MemberAssignment {
  /** A location ID or "ALL". */
  readonly locationId: string;
  readonly roleId: string;
}

/**
 * What iam needs from the members of the active organization. Implemented by core/organization,
 * which owns members, and wired in routes/v1.ts. Both methods run in the organization context.
 */
export interface MemberAccessReader {
  /** The assignments of one member; empty when the member does not exist. */
  findAssignments(memberId: string): Promise<readonly MemberAssignment[]>;
  /**
   * For each role: how many ACTIVE members hold it at any location (once per member), in one
   * query. A role nobody holds is absent from the map.
   */
  countActiveMembersByRole(roleIds: readonly RoleId[]): Promise<ReadonlyMap<string, number>>;
}
