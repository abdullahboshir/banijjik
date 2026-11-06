import type {
  DeliveryAssignmentResponse,
  RiderCashHandoverResponse,
} from "@banijjik/contracts/delivery";
import type { DeliveryAssignment } from "../domain/delivery-assignment.entity.js";
import type { RiderCashHandover } from "../domain/rider-cash-handover.entity.js";

export function toDeliveryAssignmentResponse(
  assignment: DeliveryAssignment,
): DeliveryAssignmentResponse {
  return {
    deliveryAssignmentId: assignment.deliveryAssignmentId,
    organizationId: assignment.organizationId,
    locationId: assignment.locationId,
    orderId: assignment.orderId,
    riderMemberId: assignment.riderMemberId,
    attemptOrdinal: assignment.attemptOrdinal,
    status: assignment.status,
    notes: assignment.notes,
    version: assignment.version,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}

export function toRiderCashHandoverResponse(
  handover: RiderCashHandover,
): RiderCashHandoverResponse {
  return {
    riderCashHandoverId: handover.riderCashHandoverId,
    organizationId: handover.organizationId,
    locationId: handover.locationId,
    riderMemberId: handover.riderMemberId,
    receivedByMemberId: handover.receivedByMemberId,
    paymentIds: handover.paymentIds,
    amount: handover.amount,
    receivedVia: handover.receivedVia,
    posSessionId: handover.posSessionId,
    businessDate: handover.businessDate,
    reversesRiderCashHandoverId: handover.reversesRiderCashHandoverId,
    reversalReason: handover.reversalReason,
    version: handover.version,
    createdAt: handover.createdAt.toISOString(),
    updatedAt: handover.updatedAt.toISOString(),
  };
}
