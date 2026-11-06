import { defineEnum } from "../define-enum.js";
import type { Money } from "../pricing/pricing-contracts.js";

export type { Money };

export const DELIVERY_ASSIGNMENT_STATUS = defineEnum([
  "ASSIGNED",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
]);
export type DeliveryAssignmentStatus =
  (typeof DELIVERY_ASSIGNMENT_STATUS)[keyof typeof DELIVERY_ASSIGNMENT_STATUS];

export const RIDER_HANDOVER_RECEIVED_VIA = defineEnum([
  "CASH",
  "BANK",
  "BKASH",
  "NAGAD",
]);
export type RiderHandoverReceivedVia =
  (typeof RIDER_HANDOVER_RECEIVED_VIA)[keyof typeof RIDER_HANDOVER_RECEIVED_VIA];

export const MAX_HANDOVER_PAYMENTS = 100;
export const MAX_DELIVERY_NOTES_LENGTH = 500;
export const MAX_HANDOVER_REASON_LENGTH = 200;

export interface CreateDeliveryAssignmentRequest {
  readonly orderId: string;
  readonly riderMemberId: string;
  readonly notes?: string | undefined;
  readonly shipOrder?: boolean | undefined;
}

export interface DeliveryAssignmentResponse {
  readonly deliveryAssignmentId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly orderId: string;
  readonly riderMemberId: string;
  readonly attemptOrdinal: number;
  readonly status: DeliveryAssignmentStatus;
  readonly notes: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecordRiderCashHandoverRequest {
  readonly riderMemberId: string;
  readonly paymentIds: readonly string[];
  readonly receivedVia: RiderHandoverReceivedVia;
  readonly posSessionId?: string | undefined;
  readonly businessDate: string;
}

export interface RiderCashHandoverResponse {
  readonly riderCashHandoverId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly riderMemberId: string;
  readonly receivedByMemberId: string;
  readonly paymentIds: readonly string[];
  readonly amount: Money;
  readonly receivedVia: RiderHandoverReceivedVia;
  readonly posSessionId: string | null;
  readonly businessDate: string;
  readonly reversesRiderCashHandoverId: string | null;
  readonly reversalReason: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ReverseRiderCashHandoverRequest {
  readonly version: number;
  readonly reason: string;
  readonly approvalToken: string;
}

export const DELIVERY_EVENT_TYPE = {
  ASSIGNMENT_CREATED: "delivery.assignment.created",
  ASSIGNMENT_UPDATED: "delivery.assignment.updated",
  HANDOVER_RECORDED: "delivery.handover.recorded",
  HANDOVER_REVERSED: "delivery.handover.reversed",
} as const;

export type DeliveryEventType =
  (typeof DELIVERY_EVENT_TYPE)[keyof typeof DELIVERY_EVENT_TYPE];
