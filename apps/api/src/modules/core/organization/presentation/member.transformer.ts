import type { MemberResponse } from "@banijjik/contracts";
import type { Member } from "../domain/member.entity.js";
import { toAssignmentResponses } from "./assignment.transformer.js";

/** `customFields` is given only by the detail and the update; the list and the transitions leave it out. */
export function toMemberResponse(
  member: Member,
  customFields?: Record<string, unknown>,
): MemberResponse {
  return {
    memberId: member.memberId,
    userId: member.userId,
    status: member.status,
    displayName: member.displayName,
    assignments: toAssignmentResponses(member.assignments),
    joinedAt: member.joinedAt.toISOString(),
    version: member.version,
    ...(customFields === undefined ? {} : { customFields }),
    ...(member.jobTitle === undefined ? {} : { jobTitle: member.jobTitle }),
    ...(member.employeeNumber === undefined ? {} : { employeeNumber: member.employeeNumber }),
  };
}
