import { MEMBER_STATUS } from "@banijjik/contracts";
import type { MemberId, UserId } from "@banijjik/ids";
import type { ApprovalMemberStore, ApprovalMemberView } from "../../iam/index.js";
import type { Member } from "../domain/member.entity.js";
import { MongoMemberRepository } from "./mongo-member.repository.js";

function toView(member: Member): ApprovalMemberView {
  return {
    memberId: member.memberId,
    userId: member.userId,
    displayName: member.displayName,
    status: member.status,
    assignments: member.assignments.map((assignment) => ({
      locationId: assignment.locationId,
      roleId: assignment.roleId,
    })),
    approvalPinHash: member.approvalPinHash,
    approvalPinFailedCount: member.approvalPinFailedCount,
    approvalPinLockedUntil: member.approvalPinLockedUntil,
    version: member.version,
  };
}

/**
 * Approval PIN persistence on Member. Lives here because Member is owned by organization; the
 * port type is defined in iam (card 3.4b).
 */
export class MongoApprovalMemberStore implements ApprovalMemberStore {
  constructor(private readonly members = new MongoMemberRepository()) {}

  async findById(memberId: MemberId): Promise<ApprovalMemberView | undefined> {
    const member = await this.members.findById(memberId);
    return member === undefined ? undefined : toView(member);
  }

  async findByUserId(userId: UserId): Promise<ApprovalMemberView | undefined> {
    const member = await this.members.findByUserId(userId);
    return member === undefined ? undefined : toView(member);
  }

  async listActive(): Promise<ApprovalMemberView[]> {
    const page = await this.members.list({
      status: MEMBER_STATUS.ACTIVE,
      page: 1,
      limit: 100,
      reach: "ALL",
    });
    return page.items.map(toView);
  }

  async setPin(memberId: MemberId, pinHash: string, actorUserId: UserId): Promise<void> {
    const member = await this.requireMember(memberId);
    await this.members.update(member.withApprovalPin(pinHash), member.version, actorUserId);
  }

  async clearPin(memberId: MemberId, actorUserId: UserId): Promise<void> {
    const member = await this.requireMember(memberId);
    await this.members.update(member.withoutApprovalPin(), member.version, actorUserId);
  }

  async recordPinAttempt(
    memberId: MemberId,
    next: { readonly failedCount: number; readonly lockedUntil: Date | undefined },
    actorUserId: UserId,
  ): Promise<void> {
    const member = await this.requireMember(memberId);
    const updated =
      next.failedCount === 0
        ? member.withPinSuccess()
        : member.withPinFailure(next.failedCount, next.lockedUntil);
    await this.members.update(updated, member.version, actorUserId);
  }

  private async requireMember(memberId: MemberId): Promise<Member> {
    const member = await this.members.findById(memberId);
    if (member === undefined) {
      throw new Error("approval member missing after a successful read");
    }
    return member;
  }
}

export function buildApprovalMemberStore(): ApprovalMemberStore {
  return new MongoApprovalMemberStore();
}
