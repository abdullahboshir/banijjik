import type {
  CreditPurchaseMethod,
  CreditPurchaseSnapshot,
  CreditPurchaseStatus,
} from "@banijjik/contracts/credit";
import { CREDIT_PURCHASE_STATUS } from "@banijjik/contracts/credit";
import {
  newId,
  type CreditPurchaseId,
  type CustomerAccountId,
  type OrganizationId,
} from "@banijjik/ids";
import { CreditPurchaseNotPendingError } from "./errors.js";

export interface CreditPurchaseProps {
  readonly creditPurchaseId: CreditPurchaseId;
  readonly organizationId: OrganizationId;
  readonly purchaseNumber: string;
  readonly customerAccountId: CustomerAccountId;
  readonly creditPackId: string;
  readonly snapshot: CreditPurchaseSnapshot;
  readonly method: CreditPurchaseMethod;
  readonly senderPhoneE164: string;
  readonly transactionReference: string;
  readonly status: CreditPurchaseStatus;
  readonly verifiedByUserId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly creditEntryId: string | null;
  readonly submittedAt: Date;
  readonly expiresAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewCreditPurchaseInput {
  readonly organizationId: OrganizationId;
  readonly purchaseNumber: string;
  readonly customerAccountId: CustomerAccountId;
  readonly creditPackId: string;
  readonly snapshot: CreditPurchaseSnapshot;
  readonly method: CreditPurchaseMethod;
  readonly senderPhoneE164: string;
  readonly transactionReference: string;
  readonly submittedAt: Date;
  readonly expiresAt: Date;
}

export class CreditPurchase implements CreditPurchaseProps {
  readonly creditPurchaseId: CreditPurchaseId;
  readonly organizationId: OrganizationId;
  readonly purchaseNumber: string;
  readonly customerAccountId: CustomerAccountId;
  readonly creditPackId: string;
  readonly snapshot: CreditPurchaseSnapshot;
  readonly method: CreditPurchaseMethod;
  readonly senderPhoneE164: string;
  readonly transactionReference: string;
  readonly status: CreditPurchaseStatus;
  readonly verifiedByUserId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly creditEntryId: string | null;
  readonly submittedAt: Date;
  readonly expiresAt: Date;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: CreditPurchaseProps) {
    this.creditPurchaseId = props.creditPurchaseId;
    this.organizationId = props.organizationId;
    this.purchaseNumber = props.purchaseNumber;
    this.customerAccountId = props.customerAccountId;
    this.creditPackId = props.creditPackId;
    this.snapshot = props.snapshot;
    this.method = props.method;
    this.senderPhoneE164 = props.senderPhoneE164;
    this.transactionReference = props.transactionReference;
    this.status = props.status;
    this.verifiedByUserId = props.verifiedByUserId;
    this.verifiedAt = props.verifiedAt;
    this.rejectionReason = props.rejectionReason;
    this.creditEntryId = props.creditEntryId;
    this.submittedAt = props.submittedAt;
    this.expiresAt = props.expiresAt;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(input: NewCreditPurchaseInput): CreditPurchase {
    return new CreditPurchase({
      creditPurchaseId: newId(),
      organizationId: input.organizationId,
      purchaseNumber: input.purchaseNumber,
      customerAccountId: input.customerAccountId,
      creditPackId: input.creditPackId,
      snapshot: input.snapshot,
      method: input.method,
      senderPhoneE164: input.senderPhoneE164,
      transactionReference: input.transactionReference,
      status: CREDIT_PURCHASE_STATUS.PENDING,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
      creditEntryId: null,
      submittedAt: input.submittedAt,
      expiresAt: input.expiresAt,
      version: 1,
      createdAt: input.submittedAt,
      updatedAt: input.submittedAt,
    });
  }

  static restore(props: CreditPurchaseProps): CreditPurchase {
    return new CreditPurchase(props);
  }

  isPending(): boolean {
    return this.status === CREDIT_PURCHASE_STATUS.PENDING;
  }

  isVerified(): boolean {
    return this.status === CREDIT_PURCHASE_STATUS.VERIFIED;
  }

  verify(input: {
    readonly verifiedByUserId: string;
    readonly verifiedAt: Date;
    readonly creditEntryId: string;
  }): CreditPurchase {
    if (this.status === CREDIT_PURCHASE_STATUS.VERIFIED) {
      return this;
    }
    if (this.status !== CREDIT_PURCHASE_STATUS.PENDING) {
      throw new CreditPurchaseNotPendingError();
    }
    return new CreditPurchase({
      ...this.props(),
      status: CREDIT_PURCHASE_STATUS.VERIFIED,
      verifiedByUserId: input.verifiedByUserId,
      verifiedAt: input.verifiedAt,
      creditEntryId: input.creditEntryId,
      version: this.version + 1,
      updatedAt: input.verifiedAt,
    });
  }

  reject(input: {
    readonly verifiedByUserId: string;
    readonly verifiedAt: Date;
    readonly rejectionReason: string;
  }): CreditPurchase {
    if (this.status !== CREDIT_PURCHASE_STATUS.PENDING) {
      throw new CreditPurchaseNotPendingError();
    }
    return new CreditPurchase({
      ...this.props(),
      status: CREDIT_PURCHASE_STATUS.REJECTED,
      verifiedByUserId: input.verifiedByUserId,
      verifiedAt: input.verifiedAt,
      rejectionReason: input.rejectionReason,
      version: this.version + 1,
      updatedAt: input.verifiedAt,
    });
  }

  cancel(now: Date): CreditPurchase {
    if (this.status !== CREDIT_PURCHASE_STATUS.PENDING) {
      throw new CreditPurchaseNotPendingError();
    }
    return new CreditPurchase({
      ...this.props(),
      status: CREDIT_PURCHASE_STATUS.CANCELLED,
      version: this.version + 1,
      updatedAt: now,
    });
  }

  private props(): CreditPurchaseProps {
    return { ...this };
  }
}
