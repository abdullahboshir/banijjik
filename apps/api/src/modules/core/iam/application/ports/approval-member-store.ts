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

/** Outcome of an atomic wrong-PIN slot reservation (card 3.4b review R1-1). */
export interface ReservedPinAttempt {
  readonly failedCount: number;
  readonly lockedUntil: Date | undefined;
}

export interface PinAttemptLimits {
  readonly maxFailures: number;
  readonly lockMinutes: number;
}

export interface ReservePinAttemptInput {
  readonly memberId: MemberId;
  readonly now: Date;
  readonly actorUserId: UserId;
  readonly limits: PinAttemptLimits;
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
  /**
   * Atomically claims one failure slot before the PIN is checked, so parallel guesses cannot all
   * verify. Returns undefined when the PIN is already locked or no slot remains.
   */
  reservePinAttempt(input: ReservePinAttemptInput): Promise<ReservedPinAttempt | undefined>;
  /** Clears failure counters after a correct PIN (direct update, not versioned). */
  clearPinFailures(memberId: MemberId, actorUserId: UserId): Promise<void>;
}
