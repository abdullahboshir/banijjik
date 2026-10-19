import type { ApprovalAction } from "@banijjik/contracts/iam";
import type { MemberId, OrganizationId, UserId } from "@banijjik/ids";
import type { CurrencyCode } from "@banijjik/contracts";

export interface ApprovalMoney {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export interface ApprovalTokenRecord {
  readonly approvalTokenId: string;
  readonly organizationId: OrganizationId;
  readonly tokenHash: string;
  readonly action: ApprovalAction;
  readonly subjectKey: string;
  readonly amount: ApprovalMoney | undefined;
  readonly approverMemberId: MemberId;
  readonly requestedByUserId: UserId;
  readonly expiresAt: Date;
  readonly usedAt: Date | undefined;
}

export interface NewApprovalToken {
  readonly organizationId: OrganizationId;
  readonly tokenHash: string;
  readonly action: ApprovalAction;
  readonly subjectKey: string;
  readonly amount: ApprovalMoney | undefined;
  readonly approverMemberId: MemberId;
  readonly requestedByUserId: UserId;
  readonly expiresAt: Date;
  readonly createdByUserId: UserId;
  readonly now: Date;
}

export interface ApprovalTokenRepository {
  insert(token: NewApprovalToken): Promise<ApprovalTokenRecord>;
  findByHash(tokenHash: string): Promise<ApprovalTokenRecord | undefined>;
  /** Marks used when still unused; returns undefined when already used or missing. */
  markUsed(tokenHash: string, usedAt: Date): Promise<ApprovalTokenRecord | undefined>;
}
