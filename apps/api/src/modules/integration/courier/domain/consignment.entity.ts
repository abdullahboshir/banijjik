import type { ConsignmentStatus, ManualCourierKey } from "@banijjik/contracts";
import {
  newId,
  type ConsignmentId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";

export interface ConsignmentProps {
  readonly consignmentId: ConsignmentId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly orderId: OrderId;
  readonly attemptOrdinal: number;
  readonly courierKey: ManualCourierKey;
  readonly trackingNumber: string;
  readonly status: ConsignmentStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export class Consignment {
  readonly consignmentId: ConsignmentId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly orderId: OrderId;
  readonly attemptOrdinal: number;
  readonly courierKey: ManualCourierKey;
  readonly trackingNumber: string;
  readonly status: ConsignmentStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  constructor(props: ConsignmentProps) {
    this.consignmentId = props.consignmentId;
    this.organizationId = props.organizationId;
    this.locationId = props.locationId;
    this.orderId = props.orderId;
    this.attemptOrdinal = props.attemptOrdinal;
    this.courierKey = props.courierKey;
    this.trackingNumber = props.trackingNumber;
    this.status = props.status;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.createdByUserId = props.createdByUserId;
    this.updatedByUserId = props.updatedByUserId;
  }

  static create(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: LocationId;
    readonly orderId: OrderId;
    readonly attemptOrdinal: number;
    readonly courierKey: ManualCourierKey;
    readonly trackingNumber: string;
    readonly actorUserId: UserId;
    readonly now: Date;
  }): Consignment {
    return new Consignment({
      consignmentId: newId<ConsignmentId>(),
      organizationId: input.organizationId,
      locationId: input.locationId,
      orderId: input.orderId,
      attemptOrdinal: input.attemptOrdinal,
      courierKey: input.courierKey,
      trackingNumber: input.trackingNumber,
      status: "BOOKED",
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }

  cancel(input: { readonly actorUserId: UserId; readonly now: Date }): Consignment {
    return new Consignment({
      ...this,
      status: "CANCELLED",
      version: this.version + 1,
      updatedAt: input.now,
      updatedByUserId: input.actorUserId,
    });
  }
}
