import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, MEMBER_STATUS } from "@banijjik/contracts";
import type { MemberId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { invalidField } from "../../domain/errors.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { ApprovalMemberStore } from "../ports/approval-member-store.js";

export interface RemoveApprovalPinInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly memberId: MemberId;
}

export interface RemoveApprovalPinDependencies {
  readonly members: ApprovalMemberStore;
  readonly unitOfWork: UnitOfWork;
  readonly audit: AuditRecorder;
}

/** Removes the caller's approval PIN (ADR-121). */
export class RemoveApprovalPinUseCase {
  constructor(private readonly dependencies: RemoveApprovalPinDependencies) {}

  async execute(input: RemoveApprovalPinInput): Promise<void> {
    const { members, unitOfWork, audit } = this.dependencies;
    const member = await members.findById(input.memberId);
    if (member === undefined || member.status !== MEMBER_STATUS.ACTIVE) {
      throw invalidField("memberId", "validation.invalid_value");
    }
    if (member.userId !== input.actorUserId) {
      throw invalidField("memberId", "validation.invalid_value");
    }
    await unitOfWork.run(async () => {
      await members.clearPin(input.memberId, input.actorUserId);
      await audit.record({
        action: AUDIT_ACTION.APPROVAL_PIN_REMOVED,
        entityType: AUDIT_ENTITY_TYPE.approvalPin,
        entityId: input.memberId,
        changes: { hasPin: { from: true, to: false } },
      });
    });
  }
}
