import { ALL_LOCATIONS } from "@banijjik/contracts";
import {
  asId,
  type LocationId,
  type MemberId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { Member, type Assignment } from "../domain/member.entity.js";
import { toAuthorId } from "./author-id.js";
import type { AssignmentDocument, MemberDocument } from "./member.schema.js";

export function toAssignmentDocument(assignment: Assignment): AssignmentDocument {
  return { locationId: assignment.locationId, roleId: assignment.roleId };
}

export function toAssignment(document: AssignmentDocument): Assignment {
  return {
    locationId:
      document.locationId === ALL_LOCATIONS ? ALL_LOCATIONS : asId<LocationId>(document.locationId),
    roleId: asId<RoleId>(document.roleId),
  };
}

/** The document to insert. Optional fields that are absent are left out, not stored as null. */
export function toMemberDocument(member: Member): MemberDocument {
  return {
    memberId: member.memberId,
    organizationId: member.organizationId,
    userId: member.userId,
    status: member.status,
    assignments: member.assignments.map(toAssignmentDocument),
    displayName: member.displayName,
    customFields: { ...member.customFields },
    customFieldSearch: member.customFieldSearch.map((entry) => ({ ...entry })),
    joinedAt: member.joinedAt,
    version: member.version,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
    createdByUserId: member.createdByUserId,
    updatedByUserId: null,
    ...(member.jobTitle === undefined ? {} : { jobTitle: member.jobTitle }),
    ...(member.employeeNumber === undefined ? {} : { employeeNumber: member.employeeNumber }),
    ...(member.approvalPinHash === undefined ? {} : { approvalPinHash: member.approvalPinHash }),
    ...(member.approvalPinFailedCount === 0
      ? {}
      : { approvalPinFailedCount: member.approvalPinFailedCount }),
    ...(member.approvalPinLockedUntil === undefined
      ? {}
      : { approvalPinLockedUntil: member.approvalPinLockedUntil }),
  };
}

export function toMember(document: MemberDocument): Member {
  const stored = stripMongoInternals(document);
  return Member.restore({
    memberId: asId<MemberId>(stored.memberId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    userId: asId<UserId>(stored.userId),
    status: stored.status,
    assignments: stored.assignments.map(toAssignment),
    displayName: stored.displayName,
    jobTitle: stored.jobTitle,
    employeeNumber: stored.employeeNumber,
    customFields: stored.customFields ?? {},
    customFieldSearch: stored.customFieldSearch ?? [],
    approvalPinHash: stored.approvalPinHash,
    approvalPinFailedCount: stored.approvalPinFailedCount ?? 0,
    approvalPinLockedUntil: stored.approvalPinLockedUntil,
    joinedAt: stored.joinedAt,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: toAuthorId(stored.createdByUserId),
  });
}
