import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ORGANIZATION_EVENT_TYPE } from "@banijjik/contracts";
import type { MemberId } from "@banijjik/ids";
import { diffAssignments } from "../../domain/assignment-rules.js";
import type { Member, MemberChanges } from "../../domain/member.entity.js";
import type { Reach } from "../../domain/reach.js";
import { diffAuditFields } from "../../../../../kernel/audit/index.js";
import { viewMember, type MemberDetailView } from "../custom-field-view.js";
import { assertFileValuesUsable } from "../custom-field-file-values.js";
import { mergeCustomFieldValues, type MergedCustomFields } from "../custom-field-values.js";
import { assertAssignmentsInReach, requireMemberInReach } from "../member-reach.js";
import type {
  FileReferenceChecker,
  OrganizationCustomFieldReader,
  SensitiveValueAccess,
} from "../ports/custom-field-ports.js";
import { assertMemberMayBeChanged } from "./member-protection.js";
import { revokeInvitationsOfInviter } from "./revoke-inviter-invitations.js";
import type { MemberActorInput } from "./member-actor-input.js";
import type { MemberDependencies } from "./member-dependencies.js";
import { memberAuditFields } from "./member-audit-fields.js";

export interface UpdateMemberDependencies extends MemberDependencies {
  readonly customFields: OrganizationCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly fileReferences: FileReferenceChecker;
}

export interface UpdateMemberInput extends MemberActorInput {
  readonly memberId: MemberId;
  readonly version: number;
  readonly changes: Omit<MemberChanges, "customFields">;
  /** Per key: a value sets it, `null` clears it, an absent key leaves it. Validated against the member fields. */
  readonly customFields?: Readonly<Record<string, unknown>>;
  /** Where the caller holds `organization.member.update`: the member and the new assignments must lie inside. */
  readonly reach: Reach;
}

/**
 * Edits a member's display name, job title, assignments and custom field values (ADR-092,
 * ADR-107). Changing assignments is the sensitive part: the OWNER role is never assignable,
 * nobody changes their own, the owner member is protected, and the caller must already hold every
 * permission of every role they give or take away. The member version moves, so the next request
 * of that member sees the change.
 */
export class UpdateMemberUseCase {
  constructor(private readonly dependencies: UpdateMemberDependencies) {}

  async execute(input: UpdateMemberInput): Promise<MemberDetailView> {
    const { members, unitOfWork, customFields, sensitiveAccess, fileReferences } =
      this.dependencies;
    const fields = await customFields.forEntity(input.organizationId, "member");
    if (input.customFields !== undefined) {
      await assertFileValuesUsable({
        checker: fileReferences,
        fields,
        requested: input.customFields,
      });
    }
    const saved = await unitOfWork.run(async () => {
      const existing = requireMemberInReach(await members.findById(input.memberId), input.reach);
      await assertMemberMayBeChanged(this.dependencies, {
        target: existing,
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        changesAssignments: input.changes.assignments !== undefined,
      });
      const merged =
        input.customFields === undefined
          ? undefined
          : mergeCustomFieldValues({
              stored: existing.customFields,
              requested: input.customFields,
              fields,
              canWriteSensitive: await sensitiveAccess.mayReadMemberSensitive(),
            });
      const edited = existing.withChanges({
        ...input.changes,
        ...(merged === undefined ? {} : { customFields: merged }),
      });
      assertAssignmentsInReach(edited.assignments, input.reach);
      const hasChangedAssignments = await this.guardAssignments(existing, edited);
      const updated = await members.update(edited, input.version, input.actorUserId);
      await this.record(existing, updated, merged);
      if (hasChangedAssignments) {
        await revokeInvitationsOfInviter(this.dependencies, existing.userId, input.actorUserId);
      }
      return updated;
    });
    return viewMember(sensitiveAccess, saved, fields);
  }

  /** Returns whether the assignments changed at all. */
  private async guardAssignments(before: Member, after: Member): Promise<boolean> {
    const { guard } = this.dependencies;
    const { added, removed } = diffAssignments(before.assignments, after.assignments);
    if (added.length === 0 && removed.length === 0) return false;
    await guard.assertAssignable(after.assignments);
    await guard.assertCallerHolds([...added, ...removed]);
    return true;
  }

  private async record(
    before: Member,
    after: Member,
    merged: MergedCustomFields | undefined,
  ): Promise<void> {
    const { audit, events } = this.dependencies;
    const changes = {
      ...diffAuditFields(memberAuditFields(before), memberAuditFields(after)),
      ...merged?.auditChanges,
    };
    await audit.record({
      action: AUDIT_ACTION.MEMBER_UPDATED,
      entityType: AUDIT_ENTITY_TYPE.member,
      entityId: after.memberId,
      changes,
    });
    // A rename alone changes nobody's access, so it publishes nothing (as a role rename does).
    if (changes["assignments"] === undefined) return;
    await events.publish(ORGANIZATION_EVENT_TYPE.MEMBER_ASSIGNMENTS_CHANGED, {
      memberId: after.memberId,
      userId: after.userId,
    });
  }
}
