import { ALL_LOCATIONS, PERMISSION_KEY, SYSTEM_ROLE_KEY } from "@banijjik/contracts";
import { asId, type RoleId } from "@banijjik/ids";
import { locationsGranting, type GrantMap } from "../domain/grant-map.js";
import type { PermissionResolver } from "./permission-resolver.js";
import type { RoleManagementRepository } from "./ports/role-management-repository.js";
import type { ApprovalMemberView } from "./ports/approval-member-store.js";

/** True when the member holds `iam.approval.grant` at the location (or at ALL). */
export function canApproveAtLocation(grantMap: GrantMap, locationId: string): boolean {
  const locations = locationsGranting(grantMap, PERMISSION_KEY.IAM_APPROVAL_GRANT);
  return locations === ALL_LOCATIONS || locations.includes(locationId);
}

/** True when any assignment is the OWNER system role. */
export function memberIsOwner(
  member: ApprovalMemberView,
  roleKeyById: ReadonlyMap<string, string>,
): boolean {
  return member.assignments.some(
    (assignment) => roleKeyById.get(assignment.roleId) === SYSTEM_ROLE_KEY.OWNER,
  );
}

export async function grantMapOfMember(
  member: ApprovalMemberView,
  roles: Pick<RoleManagementRepository, "findByIds">,
  resolver: PermissionResolver,
): Promise<GrantMap> {
  const roleIds = member.assignments.map((assignment) => asId<RoleId>(assignment.roleId));
  const loaded = await roles.findByIds(roleIds);
  return resolver.resolve(member.assignments, loaded);
}
