import { defineEnum } from "../define-enum.js";
import type { LocalizedText } from "../platform/industry-template.js";
import type { Money } from "../pricing/pricing-contracts.js";

/**
 * Delivery address stored on a COURIER/OWN_RIDER order. `phoneE164` is E.164 at every boundary.
 */
export interface DeliveryAddress {
  readonly recipientName: string;
  readonly phoneE164: string;
  readonly addressLine: string;
  readonly districtCode: string;
  readonly areaCode: string;
  readonly postalCode: string | null;
}

export const DELIVERY_ZONE_STATUS = { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" } as const;
export type DeliveryZoneStatus = (typeof DELIVERY_ZONE_STATUS)[keyof typeof DELIVERY_ZONE_STATUS];

/**
 * COD delivery rule keys. Kept off `SALES_RULE_KEY` so the admin new-order route does not
 * load them with `@banijjik/contracts/sales` (initial JS budget).
 */
export const SALES_DELIVERY_RULE_KEY = {
  DELIVERY_ZONE_UNAVAILABLE: "DELIVERY_ZONE_UNAVAILABLE",
  DELIVERY_ZONE_CURRENCY_MISMATCH: "DELIVERY_ZONE_CURRENCY_MISMATCH",
  DELIVERY_ADDRESS_REQUIRED: "DELIVERY_ADDRESS_REQUIRED",
  DELIVERY_METHOD_NOT_COMPLETABLE: "DELIVERY_METHOD_NOT_COMPLETABLE",
  ADDRESS_NOT_ALLOWED_FOR_METHOD: "ADDRESS_NOT_ALLOWED_FOR_METHOD",
  DISPATCH_METHOD_MISMATCH: "DISPATCH_METHOD_MISMATCH",
} as const;
export type SalesDeliveryRuleKey =
  (typeof SALES_DELIVERY_RULE_KEY)[keyof typeof SALES_DELIVERY_RULE_KEY];

export interface DeliveryZone {
  readonly deliveryZoneId: string;
  readonly organizationId: string;
  readonly zoneKey: string;
  readonly name: LocalizedText;
  readonly areaCodes: readonly string[];
  readonly fee: Money;
  readonly status: DeliveryZoneStatus;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: string;
  readonly updatedByUserId: string;
}

export interface CreateDeliveryZoneRequest {
  readonly zoneKey: string;
  readonly name: LocalizedText;
  readonly areaCodes: readonly string[];
  readonly feeMinor: number;
  readonly status: DeliveryZoneStatus;
}

export interface UpdateDeliveryZoneRequest {
  readonly version: number;
  readonly name?: LocalizedText;
  readonly areaCodes?: readonly string[];
  readonly feeMinor?: number;
  readonly status?: DeliveryZoneStatus;
}

export interface DeliveryAttempt {
  readonly deliveryAttemptId: string;
  readonly organizationId: string;
  readonly orderId: string;
  readonly ordinal: number;
  readonly method: "COURIER" | "OWN_RIDER";
  readonly consignmentId: string | null;
  readonly deliveryAssignmentId: string | null;
  readonly startedAt: Date;
  readonly failedAt: Date | null;
  readonly reasonKey: string | null;
  readonly note: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: string;
  readonly updatedByUserId: string;
}

export interface ShipOrderRequest {
  readonly version: number;
  readonly dispatch:
    | { readonly method: "COURIER"; readonly consignmentId: string }
    | { readonly method: "OWN_RIDER"; readonly deliveryAssignmentId: string };
}

export const SALES_DELIVERY_FAIL_REASON = defineEnum([
  "RECIPIENT_UNAVAILABLE",
  "REFUSED",
  "ADDRESS_INVALID",
  "OTHER",
]);
export type DeliveryFailReasonKey =
  (typeof SALES_DELIVERY_FAIL_REASON)[keyof typeof SALES_DELIVERY_FAIL_REASON];

export const MAX_DELIVERY_FAIL_NOTE_LENGTH = 200;

export interface DeliveryFailedRequest {
  readonly version: number;
  readonly reasonKey: DeliveryFailReasonKey;
  readonly note?: string | undefined;
}

export interface FirstShipmentPostingFacts {
  readonly shipmentEventId: string;
  readonly deliveryAttemptId: string;
  readonly shippedAt: Date;
  readonly businessDate: string;
  readonly lines: readonly {
    readonly orderLineId: string;
    readonly quantity: number;
    readonly unitCostSnapshot: Money | null;
    readonly lineNetTotal: Money;
  }[];
  readonly netRevenue: Money;
  readonly taxTotal: Money;
  readonly deliveryIncome: Money;
  readonly netPaidAtShipment: Money;
}

export interface OrderDeliveryResponse {
  readonly address: DeliveryAddress | null;
  readonly deliveryZoneId: string | null;
  readonly shippedAt: string | null;
  readonly deliveredAt: string | null;
  readonly currentDeliveryAttemptId: string | null;
  readonly deliveryAttemptCount: number;
  /** Immutable first-ship snapshot, read-only; null until the first ship. */
  readonly firstShipment: FirstShipmentResponse | null;
}

export interface FirstShipmentResponse {
  readonly shipmentEventId: string;
  readonly deliveryAttemptId: string;
  readonly shippedAt: string;
  readonly businessDate: string;
  readonly netRevenue: Money;
  readonly taxTotal: Money;
  readonly deliveryIncome: Money;
  readonly netPaidAtShipment: Money;
}

export interface ReceiveRtsRequest {
  readonly version: number;
  readonly reasonKey?: string | undefined;
  readonly restockDisposition?: "RESTOCK" | "RETURN_DAMAGED" | undefined;
  readonly note?: string | undefined;
}

export interface DeliverOrderRequest {
  readonly version: number;
  readonly note?: string | undefined;
}

export interface DeliveryLossLineInput {
  readonly orderLineId: string;
  readonly restockQuantity: number;
  readonly damagedQuantity: number;
  readonly lostQuantity: number;
}

export interface ReconcileDeliveryLossRequest {
  readonly expectedVersion: number;
  readonly reasonKey: string;
  readonly approvalToken: string;
  readonly evidenceFileIds?: readonly string[] | undefined;
  readonly lines: readonly DeliveryLossLineInput[];
}

export interface RecoverDeliveryLossLineInput {
  readonly orderLineId: string;
  readonly restockQuantity: number;
  readonly damagedQuantity: number;
}

export interface RecoverDeliveryLossRequest {
  readonly expectedVersion: number;
  readonly approvalToken: string;
  readonly lines: readonly RecoverDeliveryLossLineInput[];
}

export interface DeliveryLossClosureLineResponse {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId: string | null;
  readonly shippedQuantity: number;
  readonly restockQuantity: number;
  readonly damagedQuantity: number;
  readonly lostQuantity: number;
  readonly recoveredQuantity: number;
  readonly lostCost: Money;
}

export interface DeliveryLossClosureResponse {
  readonly deliveryLossClosureId: string;
  readonly organizationId: string;
  readonly orderId: string;
  readonly locationId: string;
  readonly firstShipmentEventId: string | null;
  readonly reasonKey: string;
  readonly evidenceFileIds: readonly string[];
  readonly lines: readonly DeliveryLossClosureLineResponse[];
  readonly totalLostCost: Money;
  readonly approvalSnapshot: {
    readonly approverMemberId: string;
    readonly action: string;
  };
  readonly createdAt: string;
}

export interface DeliveryLossRecoveryLineResponse {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly inventoryItemId: string | null;
  readonly restockQuantity: number;
  readonly damagedQuantity: number;
  readonly recoveredCost: Money;
}

export interface DeliveryLossRecoveryResponse {
  readonly deliveryLossRecoveryId: string;
  readonly organizationId: string;
  readonly deliveryLossClosureId: string;
  readonly orderId: string;
  readonly locationId: string;
  readonly lines: readonly DeliveryLossRecoveryLineResponse[];
  readonly totalRecoveredCost: Money;
  readonly approvalSnapshot: {
    readonly approverMemberId: string;
    readonly action: string;
  };
  readonly createdAt: string;
}
