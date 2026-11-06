import type { DeliveryAssignmentStatus } from "@banijjik/contracts";
import type {
  DeliveryAssignmentId,
  LocationId,
  OrderId,
  OrganizationId,
  RiderCashHandoverId,
} from "@banijjik/ids";
import type { DeliveryAssignment } from "./delivery-assignment.entity.js";
import type { RiderCashHandover } from "./rider-cash-handover.entity.js";

export interface DeliveryAssignmentFilters {
  readonly organizationId: OrganizationId;
  readonly orderId?: OrderId | undefined;
  readonly riderMemberId?: string | undefined;
  readonly locationId?: LocationId | undefined;
  readonly status?: DeliveryAssignmentStatus | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface DeliveryAssignmentPage {
  readonly items: readonly DeliveryAssignment[];
  readonly total: number;
  readonly hasNext: boolean;
}

export interface DeliveryAssignmentRepository {
  insert(assignment: DeliveryAssignment): Promise<DeliveryAssignment>;
  findById(
    organizationId: OrganizationId,
    assignmentId: DeliveryAssignmentId,
  ): Promise<DeliveryAssignment | undefined>;
  countByOrder(organizationId: OrganizationId, orderId: OrderId): Promise<number>;
  list(filters: DeliveryAssignmentFilters): Promise<DeliveryAssignmentPage>;
  update(assignment: DeliveryAssignment, expectedVersion: number): Promise<DeliveryAssignment>;
}

export interface RiderCashHandoverRepository {
  insert(handover: RiderCashHandover): Promise<RiderCashHandover>;
  findById(
    organizationId: OrganizationId,
    handoverId: RiderCashHandoverId,
  ): Promise<RiderCashHandover | undefined>;
  findByReversalId(
    organizationId: OrganizationId,
    originalHandoverId: RiderCashHandoverId,
  ): Promise<RiderCashHandover | undefined>;
}
