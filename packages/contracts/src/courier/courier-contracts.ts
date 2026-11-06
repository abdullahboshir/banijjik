import { defineEnum } from "../define-enum.js";
import type { Money } from "../pricing/pricing-contracts.js";

export type { Money };

export const MANUAL_COURIER_KEY = defineEnum([
  "STEADFAST",
  "PATHAO",
  "REDX",
  "PAPERFLY",
  "OTHER",
]);
export type ManualCourierKey = (typeof MANUAL_COURIER_KEY)[keyof typeof MANUAL_COURIER_KEY];

export const CONSIGNMENT_STATUS = defineEnum([
  "BOOKED",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
]);
export type ConsignmentStatus = (typeof CONSIGNMENT_STATUS)[keyof typeof CONSIGNMENT_STATUS];

export const COURIER_SETTLEMENT_RECEIVED_VIA = defineEnum([
  "CASH",
  "BANK",
  "BKASH",
  "NAGAD",
]);
export type CourierSettlementReceivedVia =
  (typeof COURIER_SETTLEMENT_RECEIVED_VIA)[keyof typeof COURIER_SETTLEMENT_RECEIVED_VIA];

export const MAX_SETTLEMENT_PAYMENTS = 100;
export const MAX_TRACKING_NUMBER_LENGTH = 100;
export const MAX_EXTERNAL_REFERENCE_LENGTH = 100;
export const MAX_SETTLEMENT_REASON_LENGTH = 200;
export const COURIER_DEFAULT_KEY_SETTING = "courier.defaultCourierKey";

export interface CreateConsignmentRequest {
  readonly orderId: string;
  readonly courierKey: ManualCourierKey;
  readonly trackingNumber: string;
  readonly shipOrder?: boolean | undefined;
}

export interface ConsignmentResponse {
  readonly consignmentId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly orderId: string;
  readonly attemptOrdinal: number;
  readonly courierKey: ManualCourierKey;
  readonly trackingNumber: string;
  readonly status: ConsignmentStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RecordCourierSettlementRequest {
  readonly courierKey: ManualCourierKey;
  readonly paymentIds: readonly string[];
  readonly courierChargesMinor: number;
  readonly receivedVia: CourierSettlementReceivedVia;
  readonly externalReference: string;
  readonly businessDate: string;
}

export interface ReverseCourierSettlementRequest {
  readonly version: number;
  readonly reason: string;
  readonly approvalToken: string;
}

export interface CourierSettlementResponse {
  readonly courierSettlementId: string;
  readonly organizationId: string;
  readonly courierKey: ManualCourierKey;
  readonly paymentIds: readonly string[];
  readonly grossAmount: Money;
  readonly courierCharges: Money;
  readonly netReceived: Money;
  readonly receivedVia: CourierSettlementReceivedVia;
  readonly externalReference: string;
  readonly businessDate: string;
  readonly reversesCourierSettlementId: string | null;
  readonly reversalReason: string | null;
  readonly version: number;
  readonly createdAt: string;
}

export const COURIER_EVENT_TYPE = {
  CONSIGNMENT_CREATED: "courier.consignment.created",
  CONSIGNMENT_CANCELLED: "courier.consignment.cancelled",
  SETTLEMENT_RECORDED: "courier.settlement.recorded",
  SETTLEMENT_REVERSED: "courier.settlement.reversed",
} as const;

export type CourierEventType = (typeof COURIER_EVENT_TYPE)[keyof typeof COURIER_EVENT_TYPE];
