import type { MemberId, UserId } from "@banijjik/ids";

/** One staff member's fields the approval use cases need (Member lives in organization). */
export interface ApprovalMemberView {
  readonly memberId: MemberId;
  readonly userId: UserId;
  readonly displayName: string;
  readonly status: string;
  readonly assignments: readonly { readonly locationId: string; readonly roleId: string }[];
  readonly approvalPinHash: string | undefined;
  readonly approvalPinFailedCount: number;
  readonly approvalPinLockedUntil: Date | undefined;
  readonly version: number;
}

/**
 * Reads and writes the approval-PIN fields on Member. Implemented by organization; wired in
 * routes/v1.ts so iam never imports that module (ADR-011).
 */
export interface ApprovalMemberStore {
  findById(memberId: MemberId): Promise<ApprovalMemberView | undefined>;
  findByUserId(userId: UserId): Promise<ApprovalMemberView | undefined>;
  listActive(): Promise<ApprovalMemberView[]>;
  setPin(memberId: MemberId, pinHash: string, actorUserId: UserId): Promise<void>;
  clearPin(memberId: MemberId, actorUserId: UserId): Promise<void>;
  recordPinAttempt(
    memberId: MemberId,
    next: { readonly failedCount: number; readonly lockedUntil: Date | undefined },
    actorUserId: UserId,
  ): Promise<void>;
}
