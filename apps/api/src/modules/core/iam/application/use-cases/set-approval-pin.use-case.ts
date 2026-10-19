import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, MEMBER_STATUS } from "@banijjik/contracts";
import type { MemberId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { invalidCredentials, invalidField } from "../../domain/errors.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";
import type { UserRepository } from "../ports/user-repository.js";
import type { ApprovalMemberStore } from "../ports/approval-member-store.js";

export interface SetApprovalPinInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly memberId: MemberId;
  readonly currentPassword: string;
  readonly pin: string;
}

export interface SetApprovalPinDependencies {
  readonly members: ApprovalMemberStore;
  readonly users: UserRepository;
  readonly hasher: PasswordHasher;
  readonly unitOfWork: UnitOfWork;
  readonly audit: AuditRecorder;
}

/** Sets or replaces the caller's approval PIN after re-checking the account password (ADR-121). */
export class SetApprovalPinUseCase {
  constructor(private readonly dependencies: SetApprovalPinDependencies) {}

  async execute(input: SetApprovalPinInput): Promise<void> {
    const { members, users, hasher, unitOfWork, audit } = this.dependencies;
    const member = await members.findById(input.memberId);
    if (member === undefined || member.status !== MEMBER_STATUS.ACTIVE) {
      throw invalidField("memberId", "validation.invalid_value");
    }
    if (member.userId !== input.actorUserId) {
      throw invalidField("memberId", "validation.invalid_value");
    }
    const user = await users.findById(input.actorUserId);
    if (user === undefined) throw invalidCredentials();
    const passwordOk = await hasher.verify(user.passwordHash, input.currentPassword);
    if (!passwordOk) throw invalidCredentials();
    const pinHash = await hasher.hash(input.pin);
    await unitOfWork.run(async () => {
      await members.setPin(input.memberId, pinHash, input.actorUserId);
      await audit.record({
        action: AUDIT_ACTION.APPROVAL_PIN_SET,
        entityType: AUDIT_ENTITY_TYPE.approvalPin,
        entityId: input.memberId,
        changes: { hasPin: { to: true } },
      });
    });
  }
}
