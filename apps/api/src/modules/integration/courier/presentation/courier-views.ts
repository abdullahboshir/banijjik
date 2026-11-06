import type {
  ConsignmentResponse,
  CourierSettlementResponse,
} from "@banijjik/contracts/courier";
import type { Consignment } from "../domain/consignment.entity.js";
import type { CourierSettlement } from "../domain/courier-settlement.entity.js";

export function toConsignmentResponse(consignment: Consignment): ConsignmentResponse {
  return {
    consignmentId: consignment.consignmentId,
    organizationId: consignment.organizationId,
    locationId: consignment.locationId,
    orderId: consignment.orderId,
    attemptOrdinal: consignment.attemptOrdinal,
    courierKey: consignment.courierKey,
    trackingNumber: consignment.trackingNumber,
    status: consignment.status,
    version: consignment.version,
    createdAt: consignment.createdAt.toISOString(),
    updatedAt: consignment.updatedAt.toISOString(),
  };
}

export function toCourierSettlementResponse(
  settlement: CourierSettlement,
): CourierSettlementResponse {
  return {
    courierSettlementId: settlement.courierSettlementId,
    organizationId: settlement.organizationId,
    courierKey: settlement.courierKey,
    paymentIds: settlement.paymentIds,
    grossAmount: settlement.grossAmount,
    courierCharges: settlement.courierCharges,
    netReceived: settlement.netReceived,
    receivedVia: settlement.receivedVia,
    externalReference: settlement.externalReference,
    businessDate: settlement.businessDate,
    reversesCourierSettlementId: settlement.reversesCourierSettlementId,
    reversalReason: settlement.reversalReason,
    version: settlement.version,
    createdAt: settlement.createdAt.toISOString(),
  };
}
