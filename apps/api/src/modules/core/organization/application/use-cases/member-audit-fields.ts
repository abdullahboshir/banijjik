import type { Member } from "../../domain/member.entity.js";
import { type AuditFields } from "../../../../../kernel/audit/index.js";
import { assignmentsAuditValue } from "../audit-diff.js";

export function memberAuditFields(member: Member): AuditFields {
  return {
    status: member.status,
    displayName: member.displayName,
    jobTitle: member.jobTitle,
    assignments: assignmentsAuditValue(member.assignments),
  };
}
