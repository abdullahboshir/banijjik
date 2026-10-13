import type { MemberResponse } from "@banijjik/contracts";
import type { Member } from "../domain/member.entity.js";
import { toAssignmentResponses } from "./assignment.transformer.js";

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
