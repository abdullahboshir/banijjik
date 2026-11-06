import type { Money, RiderHandoverReceivedVia } from "@banijjik/contracts";
import {
  newId,
  type LocationId,
  type OrganizationId,
  type RiderCashHandoverId,
  type UserId,
} from "@banijjik/ids";
import { riderCannotApproveOwnHandover } from "./errors.js";

export interface RiderCashHandoverProps {
  readonly riderCashHandoverId: RiderCashHandoverId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly riderMemberId: string;
  readonly receivedByMemberId: string;
  readonly paymentIds: readonly string[];
  readonly amount: Money;
  readonly receivedVia: RiderHandoverReceivedVia;
  readonly posSessionId: string | null;
  readonly businessDate: string;
  readonly reversesRiderCashHandoverId: RiderCashHandoverId | null;
  readonly reversalReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export class RiderCashHandover {
  readonly riderCashHandoverId: RiderCashHandoverId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly riderMemberId: string;
  readonly receivedByMemberId: string;
  readonly paymentIds: readonly string[];
  readonly amount: Money;
  readonly receivedVia: RiderHandoverReceivedVia;
  readonly posSessionId: string | null;
  readonly businessDate: string;
  readonly reversesRiderCashHandoverId: RiderCashHandoverId | null;
  readonly reversalReason: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  constructor(props: RiderCashHandoverProps) {
    this.riderCashHandoverId = props.riderCashHandoverId;
    this.organizationId = props.organizationId;
    this.locationId = props.locationId;
    this.riderMemberId = props.riderMemberId;
    this.receivedByMemberId = props.receivedByMemberId;
    this.paymentIds = props.paymentIds;
    this.amount = props.amount;
    this.receivedVia = props.receivedVia;
    this.posSessionId = props.posSessionId;
    this.businessDate = props.businessDate;
    this.reversesRiderCashHandoverId = props.reversesRiderCashHandoverId;
    this.reversalReason = props.reversalReason;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static record(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: LocationId;
    readonly riderMemberId: string;
    readonly receivedByMemberId: string;
    readonly paymentIds: readonly string[];
    readonly amount: Money;
    readonly receivedVia: RiderHandoverReceivedVia;
    readonly posSessionId?: string | undefined;
    readonly businessDate: string;
    readonly actorUserId: UserId;
    readonly now: Date;
  }): RiderCashHandover {
    if (input.riderMemberId === input.receivedByMemberId) {
      throw riderCannotApproveOwnHandover();
    }

    return new RiderCashHandover({
      riderCashHandoverId: newId<RiderCashHandoverId>(),
      organizationId: input.organizationId,
      locationId: input.locationId,
      riderMemberId: input.riderMemberId,
      receivedByMemberId: input.receivedByMemberId,
      paymentIds: input.paymentIds,
      amount: input.amount,
      receivedVia: input.receivedVia,
      posSessionId: input.posSessionId ?? null,
      businessDate: input.businessDate,
      reversesRiderCashHandoverId: null,
      reversalReason: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  createReversal(input: {
    readonly reason: string;
    readonly actorUserId: UserId;
    readonly now: Date;
  }): RiderCashHandover {
    return new RiderCashHandover({
      riderCashHandoverId: newId<RiderCashHandoverId>(),
      organizationId: this.organizationId,
      locationId: this.locationId,
      riderMemberId: this.riderMemberId,
      receivedByMemberId: this.receivedByMemberId,
      paymentIds: this.paymentIds,
      amount: {
        amount: -this.amount.amount,
        currency: this.amount.currency,
      },
      receivedVia: this.receivedVia,
      posSessionId: this.posSessionId,
      businessDate: this.businessDate,
      reversesRiderCashHandoverId: this.riderCashHandoverId,
      reversalReason: input.reason,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }
}
