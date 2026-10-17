import {
  ALL_LOCATIONS,
  MEMBER_STATUS,
  PERMISSION_KEY,
  SYSTEM_ROLE_KEY,
  type CallerPermissionsResponse,
  type MemberResponse,
  type MemberStatus,
  type RoleSummary,
} from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { holdsPermission } from "../shell/permissions";
import { allLocationsLabel, roleLabelOf } from "./assignment-options";
import type { MemberAction } from "./member-action-labels";

const LIST_SEPARATOR = ", ";

export interface MemberLookups {
  roleById: ReadonlyMap<string, Pick<RoleSummary, "roleKey" | "nameKey" | "name">>;
  locationNameById: ReadonlyMap<string, string>;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value !== ""))];
}

/** Names of the roles a member holds, each once, in the order they were given. */
export function roleNamesOfMember(
  member: Pick<MemberResponse, "assignments">,
  lookups: MemberLookups,
  t: Translator["t"],
): string {
  const names = member.assignments.map((assignment) => {
    const role = lookups.roleById.get(assignment.roleId);
    return role ? roleLabelOf(role, t) : "";
  });
  return unique(names).join(LIST_SEPARATOR);
}

export function locationNameOf(
  locationId: string,
  lookups: MemberLookups,
  t: Translator["t"],
): string {
  if (locationId === ALL_LOCATIONS) return allLocationsLabel(t);
  return lookups.locationNameById.get(locationId) ?? "";
}

/** Names of the locations a member works at, each once. */
export function locationNamesOfMember(
  member: Pick<MemberResponse, "assignments">,
  lookups: MemberLookups,
  t: Translator["t"],
): string {
  const names = member.assignments.map((assignment) =>
    locationNameOf(assignment.locationId, lookups, t),
  );
  return unique(names).join(LIST_SEPARATOR);
}

export function isOwnerMember(
  member: Pick<MemberResponse, "assignments">,
  lookups: MemberLookups,
): boolean {
  return member.assignments.some(
    (assignment) => lookups.roleById.get(assignment.roleId)?.roleKey === SYSTEM_ROLE_KEY.OWNER,
  );
}

const STATUS_LABEL_KEY: Record<MemberStatus, string> = {
  [MEMBER_STATUS.ACTIVE]: "staff.status.active",
  [MEMBER_STATUS.SUSPENDED]: "staff.status.suspended",
  [MEMBER_STATUS.REMOVED]: "staff.status.removed",
  [MEMBER_STATUS.INVITED]: "staff.status.invited",
};

export function memberStatusLabel(status: MemberStatus, t: Translator["t"]): string {
  return t(STATUS_LABEL_KEY[status]);
}

export interface MemberActionContext {
  member: Pick<MemberResponse, "status" | "userId" | "assignments">;
  lookups: MemberLookups;
  callerUserId: string;
  permissions: CallerPermissionsResponse;
  /** False in READ_ONLY mode. */
  canWrite: boolean;
  /** The roles and locations needed to edit assignments could be read. */
  canChooseAssignments: boolean;
}

function actionsForStatus(status: MemberStatus, canUpdate: boolean, canRemove: boolean) {
  const actions: MemberAction[] = [];
  if (status === MEMBER_STATUS.ACTIVE && canUpdate) actions.push("editAssignments", "suspend");
  if (status === MEMBER_STATUS.SUSPENDED && canUpdate)
    actions.push("editAssignments", "reactivate");
  const isRemovable = status === MEMBER_STATUS.ACTIVE || status === MEMBER_STATUS.SUSPENDED;
  if (isRemovable && canRemove) actions.push("remove");
  return actions;
}

/**
 * Which actions the detail page offers: none in read-only mode, none for the owner or for oneself (the API
 * refuses both), the rest by permission and status. Hiding is a courtesy; the API still enforces everything.
 */
export function memberActionsFor(context: MemberActionContext): MemberAction[] {
  const { member, lookups, permissions } = context;
  if (!context.canWrite) return [];
  if (isOwnerMember(member, lookups) || member.userId === context.callerUserId) return [];
  const canUpdate = holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE);
  const canRemove = holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_REMOVE);
  return actionsForStatus(member.status, canUpdate, canRemove).filter(
    (action) => action !== "editAssignments" || context.canChooseAssignments,
  );
}

/**
 * Whether the detail page offers "Edit details": the same permission as any member edit, a member who
 * is not removed, and not the owner's record unless the owner is the one looking (the API refuses
 * the rest). Unlike the assignments, a person may edit their own details.
 */
export function canEditMemberDetails(
  context: Omit<MemberActionContext, "canChooseAssignments">,
): boolean {
  const { member, lookups, permissions } = context;
  if (!context.canWrite) return false;
  if (!holdsPermission(permissions, PERMISSION_KEY.ORGANIZATION_MEMBER_UPDATE)) return false;
  if (member.status !== MEMBER_STATUS.ACTIVE && member.status !== MEMBER_STATUS.SUSPENDED) {
    return false;
  }
  return !isOwnerMember(member, lookups) || member.userId === context.callerUserId;
}
