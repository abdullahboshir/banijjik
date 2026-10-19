import { MEMBER_STATUS } from "@banijjik/contracts";
import type { MemberId, UserId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  ApprovalMemberStore,
  ApprovalMemberView,
  ReservePinAttemptInput,
  ReservedPinAttempt,
} from "../../iam/index.js";
import type { Member } from "../domain/member.entity.js";
import { MEMBER_MODEL_NAME, type MemberDocument } from "./member.schema.js";
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

  async reservePinAttempt(input: ReservePinAttemptInput): Promise<ReservedPinAttempt | undefined> {
    const expired = await this.reserveAfterExpiredLock(input);
    if (expired !== undefined) return expired;
    return this.reserveNextFailure(input);
  }

  async clearPinFailures(memberId: MemberId, actorUserId: UserId): Promise<void> {
    const now = new Date();
    await this.model().updateOne(
      { memberId },
      {
        $set: { approvalPinFailedCount: 0, updatedAt: now, updatedByUserId: actorUserId },
        $unset: { approvalPinLockedUntil: "" },
      },
      sessionOption(getActiveSession()),
    );
  }

  /** Opens a new streak at 1 when the previous lock has expired. */
  private async reserveAfterExpiredLock(
    input: ReservePinAttemptInput,
  ): Promise<ReservedPinAttempt | undefined> {
    const { memberId, now, actorUserId } = input;
    const updated = await this.model()
      .findOneAndUpdate(
        { memberId, approvalPinLockedUntil: { $lte: now } },
        {
          $set: {
            approvalPinFailedCount: 1,
            updatedAt: now,
            updatedByUserId: actorUserId,
          },
          $unset: { approvalPinLockedUntil: "" },
        },
        { returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<MemberDocument>();
    return updated === null ? undefined : { failedCount: 1, lockedUntil: undefined };
  }

  /** Increments the failure count when the PIN is not locked and slots remain. */
  private async reserveNextFailure(
    input: ReservePinAttemptInput,
  ): Promise<ReservedPinAttempt | undefined> {
    const { memberId, now, actorUserId, limits } = input;
    const lockedUntil = new Date(now.getTime() + limits.lockMinutes * 60_000);
    const updated = await this.model()
      .findOneAndUpdate(
        {
          memberId,
          $and: [
            {
              $or: [
                { approvalPinLockedUntil: { $exists: false } },
                { approvalPinLockedUntil: null },
              ],
            },
            {
              $or: [
                { approvalPinFailedCount: { $exists: false } },
                { approvalPinFailedCount: { $lt: limits.maxFailures } },
              ],
            },
          ],
        },
        {
          $inc: { approvalPinFailedCount: 1 },
          $set: { updatedAt: now, updatedByUserId: actorUserId },
        },
        { returnDocument: "after", ...sessionOption(getActiveSession()) },
      )
      .lean<MemberDocument>();
    if (updated === null) return undefined;
    const failedCount = updated.approvalPinFailedCount ?? 0;
    if (failedCount < limits.maxFailures) {
      return { failedCount, lockedUntil: undefined };
    }
    await this.model().updateOne(
      { memberId },
      {
        $set: { approvalPinLockedUntil: lockedUntil, updatedAt: now, updatedByUserId: actorUserId },
      },
      sessionOption(getActiveSession()),
    );
    return { failedCount, lockedUntil };
  }

  private async requireMember(memberId: MemberId): Promise<Member> {
    const member = await this.members.findById(memberId);
    if (member === undefined) {
      throw new Error("approval member missing after a successful read");
    }
    return member;
  }

  private model() {
    return models({}).get<MemberDocument>(MEMBER_MODEL_NAME);
  }
}

export function buildApprovalMemberStore(): ApprovalMemberStore {
  return new MongoApprovalMemberStore();
}
