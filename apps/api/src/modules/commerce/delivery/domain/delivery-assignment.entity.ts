import type { DeliveryAssignmentStatus } from "@banijjik/contracts";
import {
  newId,
  type DeliveryAssignmentId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";

export interface DeliveryAssignmentProps {
  readonly deliveryAssignmentId: DeliveryAssignmentId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly orderId: OrderId;
  readonly riderMemberId: string;
  readonly attemptOrdinal: number;
  readonly status: DeliveryAssignmentStatus;
  readonly notes: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;
}

export class DeliveryAssignment {
  readonly deliveryAssignmentId: DeliveryAssignmentId;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly orderId: OrderId;
  readonly riderMemberId: string;
  readonly attemptOrdinal: number;
  readonly status: DeliveryAssignmentStatus;
  readonly notes: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: UserId;
  readonly updatedByUserId: UserId;

  constructor(props: DeliveryAssignmentProps) {
    this.deliveryAssignmentId = props.deliveryAssignmentId;
    this.organizationId = props.organizationId;
    this.locationId = props.locationId;
    this.orderId = props.orderId;
    this.riderMemberId = props.riderMemberId;
    this.attemptOrdinal = props.attemptOrdinal;
    this.status = props.status;
    this.notes = props.notes;
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
    readonly riderMemberId: string;
    readonly attemptOrdinal: number;
    readonly notes?: string | undefined;
    readonly actorUserId: UserId;
    readonly now: Date;
  }): DeliveryAssignment {
    return new DeliveryAssignment({
      deliveryAssignmentId: newId<DeliveryAssignmentId>(),
      organizationId: input.organizationId,
      locationId: input.locationId,
      orderId: input.orderId,
      riderMemberId: input.riderMemberId,
      attemptOrdinal: input.attemptOrdinal,
      status: "ASSIGNED",
      notes: input.notes ?? null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
    });
  }
}
