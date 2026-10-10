import type {
  AssignmentRequest,
  InvitationCreatedResponse,
  InvitationPreviewResponse,
  InvitationResponse,
  MemberResponse,
} from "@banijjik/contracts";
import { ALL_LOCATIONS } from "@banijjik/contracts";
import { asId, type LocationId, type RoleId } from "@banijjik/ids";
import type { InvitationPreview } from "../application/use-cases/accept-invitation.use-case.js";
import type { Invitation } from "../domain/invitation.entity.js";
import type { Assignment, Member } from "../domain/member.entity.js";

/** The assignments of a validated body as domain values. The schema already checked every ID. */
export function toAssignments(assignments: readonly AssignmentRequest[]): Assignment[] {
  return assignments.map(({ locationId, roleId }) => ({
    locationId: locationId === ALL_LOCATIONS ? ALL_LOCATIONS : asId<LocationId>(locationId),
    roleId: asId<RoleId>(roleId),
  }));
}

function toAssignmentResponses(assignments: readonly Assignment[]): AssignmentRequest[] {
  return assignments.map(({ locationId, roleId }) => ({ locationId, roleId }));
}

export function toMemberResponse(member: Member): MemberResponse {
  return {
    memberId: member.memberId,
    userId: member.userId,
    status: member.status,
    displayName: member.displayName,
    assignments: toAssignmentResponses(member.assignments),
    joinedAt: member.joinedAt.toISOString(),
    version: member.version,
    ...(member.jobTitle === undefined ? {} : { jobTitle: member.jobTitle }),
    ...(member.employeeNumber === undefined ? {} : { employeeNumber: member.employeeNumber }),
  };
}

/** The token hash and the acceptance fields never leave the API. */
export function toInvitationResponse(invitation: Invitation, now: Date): InvitationResponse {
  return {
    invitationId: invitation.invitationId,
    assignments: toAssignmentResponses(invitation.assignments),
    invitedByUserId: invitation.invitedByUserId,
    expiresAt: invitation.expiresAt.toISOString(),
    status: invitation.statusAt(now),
    version: invitation.version,
    ...(invitation.email === undefined ? {} : { email: invitation.email }),
    ...(invitation.phoneE164 === undefined ? {} : { phoneE164: invitation.phoneE164 }),
    ...(invitation.displayName === undefined ? {} : { displayName: invitation.displayName }),
  };
}

export const INVITE_URL_PATH_PREFIX = "/invitations/";

export function toInvitationCreatedResponse(
  invitation: Invitation,
  token: string,
  now: Date,
): InvitationCreatedResponse {
  return {
    ...toInvitationResponse(invitation, now),
    inviteUrlPath: `${INVITE_URL_PATH_PREFIX}${token}`,
  };
}

export function toInvitationPreviewResponse(preview: InvitationPreview): InvitationPreviewResponse {
  return {
    organizationName: preview.organizationName,
    invitedByDisplayName: preview.invitedByDisplayName,
    identifierHint: preview.identifierHint,
    status: preview.status,
  };
}
