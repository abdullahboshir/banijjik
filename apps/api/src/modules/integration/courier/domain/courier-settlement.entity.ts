import type {
  CourierSettlementReceivedVia,
  ManualCourierKey,
  Money,
} from "@banijjik/contracts";
import {
  newId,
  type CourierSettlementId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { settlementChargesExceedGross } from "./errors.js";

export interface CourierSettlementProps {
  readonly courierSettlementId: CourierSettlementId;
  readonly organizationId: OrganizationId;
  readonly courierKey: ManualCourierKey;
  readonly paymentIds: readonly string[];
  readonly grossAmount: Money;
  readonly courierCharges: Money;
  readonly netReceived: Money;
  readonly receivedVia: CourierSettlementReceivedVia;
  readonly externalReference: string;
  readonly businessDate: string;
  readonly reversesCourierSettlementId: CourierSettlementId | null;
  readonly reversalReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export class CourierSettlement {
  readonly courierSettlementId: CourierSettlementId;
  readonly organizationId: OrganizationId;
  readonly courierKey: ManualCourierKey;
  readonly paymentIds: readonly string[];
  readonly grossAmount: Money;
  readonly courierCharges: Money;
  readonly netReceived: Money;
  readonly receivedVia: CourierSettlementReceivedVia;
  readonly externalReference: string;
  readonly businessDate: string;
  readonly reversesCourierSettlementId: CourierSettlementId | null;
  readonly reversalReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  constructor(props: CourierSettlementProps) {
    this.courierSettlementId = props.courierSettlementId;
    this.organizationId = props.organizationId;
    this.courierKey = props.courierKey;
    this.paymentIds = props.paymentIds;
    this.grossAmount = props.grossAmount;
    this.courierCharges = props.courierCharges;
    this.netReceived = props.netReceived;
    this.receivedVia = props.receivedVia;
    this.externalReference = props.externalReference;
    this.businessDate = props.businessDate;
    this.reversesCourierSettlementId = props.reversesCourierSettlementId;
    this.reversalReason = props.reversalReason;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static record(input: {
    readonly organizationId: OrganizationId;
    readonly courierKey: ManualCourierKey;
    readonly paymentIds: readonly string[];
    readonly grossAmount: Money;
    readonly courierCharges: Money;
    readonly receivedVia: CourierSettlementReceivedVia;
    readonly externalReference: string;
    readonly businessDate: string;
    readonly actorUserId: UserId;
    readonly now: Date;
  }): CourierSettlement {
    if (input.courierCharges.amount > input.grossAmount.amount) {
      throw settlementChargesExceedGross(
        input.courierCharges.amount,
        input.grossAmount.amount,
      );
    }
    const netReceived: Money = {
      amount: input.grossAmount.amount - input.courierCharges.amount,
      currency: input.grossAmount.currency,
    };
    return new CourierSettlement({
      courierSettlementId: newId<CourierSettlementId>(),
      organizationId: input.organizationId,
      courierKey: input.courierKey,
      paymentIds: input.paymentIds,
      grossAmount: input.grossAmount,
      courierCharges: input.courierCharges,
      netReceived,
      receivedVia: input.receivedVia,
      externalReference: input.externalReference,
      businessDate: input.businessDate,
      reversesCourierSettlementId: null,
      reversalReason: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  static reverse(input: {
    readonly original: CourierSettlement;
    readonly reason: string;
    readonly actorUserId: UserId;
    readonly now: Date;
  }): CourierSettlement {
    return new CourierSettlement({
      courierSettlementId: newId<CourierSettlementId>(),
      organizationId: input.original.organizationId,
      courierKey: input.original.courierKey,
      paymentIds: input.original.paymentIds,
      grossAmount: {
        amount: -input.original.grossAmount.amount,
        currency: input.original.grossAmount.currency,
      },
      courierCharges: {
        amount: -input.original.courierCharges.amount,
        currency: input.original.courierCharges.currency,
      },
      netReceived: {
        amount: -input.original.netReceived.amount,
        currency: input.original.netReceived.currency,
      },
      receivedVia: input.original.receivedVia,
      externalReference: `REV-${input.original.externalReference}`,
      businessDate: input.original.businessDate,
      reversesCourierSettlementId: input.original.courierSettlementId,
      reversalReason: input.reason,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }
}
