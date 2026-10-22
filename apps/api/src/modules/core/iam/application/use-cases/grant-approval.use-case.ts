import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  MEMBER_STATUS,
  SYSTEM_ROLE_KEY,
} from "@banijjik/contracts";
import type { ApprovalAction } from "@banijjik/contracts/iam";
import { asId, type MemberId, type OrganizationId, type RoleId, type UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { APPROVAL_PIN_RULES } from "../../domain/approval-limits.js";
import { approvalInvalid, approvalPinLocked } from "../../domain/errors.js";
import { canApproveAtLocation, grantMapOfMember } from "../approval-capability.js";
import type { PermissionResolver } from "../permission-resolver.js";
import type { ApprovalMemberStore, ApprovalMemberView } from "../ports/approval-member-store.js";
import type { ApprovalMoney, ApprovalTokenRepository } from "../ports/approval-token-repository.js";
import type { ApprovalTokenSecrets } from "../ports/approval-token-secrets.js";
import type { PasswordHasher } from "../ports/password-hasher.js";
import type { RoleManagementRepository } from "../ports/role-management-repository.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface GrantApprovalInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly action: ApprovalAction;
  readonly subjectKey: string;
  readonly amount: ApprovalMoney | undefined;
  readonly locationId: string;
  readonly approverMemberId: MemberId;
  readonly pin: string;
}

export interface GrantApprovalResult {
  readonly approvalToken: string;
  readonly expiresAt: Date;
}

export interface OwnerSelfApprovalReader {
  isAllowed(organizationId: OrganizationId): Promise<boolean>;
}

export interface GrantApprovalDependencies {
  readonly members: ApprovalMemberStore;
  readonly roles: RoleManagementRepository;
  readonly tokens: ApprovalTokenRepository;
  readonly tokenSecrets: ApprovalTokenSecrets;
  readonly hasher: PasswordHasher;
  readonly resolver: PermissionResolver;
  readonly ownerSelfApproval: OwnerSelfApprovalReader;
  readonly unitOfWork: UnitOfWork;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/** Issues a single-use approval token after a correct manager PIN (ADR-121). */
export class GrantApprovalUseCase {
  constructor(private readonly dependencies: GrantApprovalDependencies) {}

  async execute(input: GrantApprovalInput): Promise<GrantApprovalResult> {
    const { members, hasher, clock } = this.dependencies;
    const approver = await members.findById(input.approverMemberId);
    if (approver === undefined || approver.status !== MEMBER_STATUS.ACTIVE) {
      throw approvalInvalid();
    }
    await this.assertMayApprove(approver, input);
    if (approver.approvalPinHash === undefined) throw approvalInvalid();
    const now = clock.now();
    const reserved = await members.reservePinAttempt({
      memberId: input.approverMemberId,
      now,
      actorUserId: input.actorUserId,
      limits: {
        maxFailures: APPROVAL_PIN_RULES.maxFailures,
        lockMinutes: APPROVAL_PIN_RULES.lockMinutes,
      },
    });
    if (reserved === undefined) {
      throw approvalPinLocked(APPROVAL_PIN_RULES.lockMinutes * 60);
    }
    const pinOk = await hasher.verify(approver.approvalPinHash, input.pin);
    if (!pinOk) {
      if (reserved.lockedUntil !== undefined) {
        throw approvalPinLocked(secondsUntil(reserved.lockedUntil, now));
      }
      throw approvalInvalid();
    }
    // Refund the reserved failure slot before issuing the token (login-style consume/refund).
    await members.clearPinFailures(input.approverMemberId, input.actorUserId);
    return this.issueToken(input, now);
  }

  private async assertMayApprove(
    approver: ApprovalMemberView,
    input: GrantApprovalInput,
  ): Promise<void> {
    const { roles, resolver, ownerSelfApproval } = this.dependencies;
    const grantMap = await grantMapOfMember(approver, roles, resolver);
    if (!canApproveAtLocation(grantMap, input.locationId)) throw approvalInvalid();
    if (approver.userId !== input.actorUserId) return;
    const roleIds = approver.assignments.map((assignment) => asId<RoleId>(assignment.roleId));
    const loaded = await roles.findByIds(roleIds);
    const isOwner = loaded.some((role) => role.isSystem && role.roleKey === SYSTEM_ROLE_KEY.OWNER);
    if (!isOwner) throw approvalInvalid();
    if (!(await ownerSelfApproval.isAllowed(input.organizationId))) throw approvalInvalid();
  }

  private async issueToken(input: GrantApprovalInput, now: Date): Promise<GrantApprovalResult> {
    const { tokens, tokenSecrets, unitOfWork, audit } = this.dependencies;
    const issued = tokenSecrets.issue();
    const expiresAt = new Date(now.getTime() + APPROVAL_PIN_RULES.tokenTtlSeconds * 1000);
    await unitOfWork.run(async () => {
      await tokens.insert({
        organizationId: input.organizationId,
        tokenHash: issued.tokenHash,
        action: input.action,
        subjectKey: input.subjectKey,
        locationId: input.locationId,
        amount: input.amount,
        approverMemberId: input.approverMemberId,
        requestedByUserId: input.actorUserId,
        expiresAt,
        createdByUserId: input.actorUserId,
        now,
      });
      await audit.record({
        action: AUDIT_ACTION.APPROVAL_GRANTED,
        entityType: AUDIT_ENTITY_TYPE.approvalToken,
        entityId: input.approverMemberId,
        changes: {
          action: { to: input.action },
          subjectKey: { to: input.subjectKey },
        },
      });
    });
    return { approvalToken: issued.token, expiresAt };
  }
}

function secondsUntil(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
}
