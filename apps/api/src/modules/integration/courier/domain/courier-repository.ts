import type { ManualCourierKey } from "@banijjik/contracts";
import type {
  ConsignmentId,
  CourierSettlementId,
  LocationId,
  OrderId,
  OrganizationId,
} from "@banijjik/ids";
import type { Consignment } from "./consignment.entity.js";
import type { CourierSettlement } from "./courier-settlement.entity.js";

export interface ConsignmentFilters {
  readonly organizationId: OrganizationId;
  readonly orderId?: OrderId | undefined;
  readonly courierKey?: ManualCourierKey | undefined;
  readonly locationId?: LocationId | undefined;
  readonly page: number;
  readonly limit: number;
}

export interface ConsignmentPage {
  readonly items: readonly Consignment[];
  readonly total: number;
  readonly hasNext: boolean;
}

export interface ConsignmentRepository {
  insert(consignment: Consignment): Promise<Consignment>;
  findById(
    organizationId: OrganizationId,
    consignmentId: ConsignmentId,
  ): Promise<Consignment | undefined>;
  findByTracking(
    organizationId: OrganizationId,
    courierKey: ManualCourierKey,
    trackingNumber: string,
  ): Promise<Consignment | undefined>;
  countByOrder(organizationId: OrganizationId, orderId: OrderId): Promise<number>;
  list(filters: ConsignmentFilters): Promise<ConsignmentPage>;
  update(consignment: Consignment, expectedVersion: number): Promise<Consignment>;
}

export interface CourierSettlementRepository {
  insert(settlement: CourierSettlement): Promise<CourierSettlement>;
  findById(
    organizationId: OrganizationId,
    settlementId: CourierSettlementId,
  ): Promise<CourierSettlement | undefined>;
  findByExternalReference(
    organizationId: OrganizationId,
    courierKey: ManualCourierKey,
    externalReference: string,
  ): Promise<CourierSettlement | undefined>;
  findByReversalId(
    organizationId: OrganizationId,
    originalSettlementId: CourierSettlementId,
  ): Promise<CourierSettlement | undefined>;
}
