import type { OrganizationId } from "@banijjik/ids";
import type { DeliveryZone } from "../../domain/delivery-zone.entity.js";

export interface DeliveryZonePage {
  readonly items: readonly DeliveryZone[];
  readonly hasNext: boolean;
}

export interface DeliveryZoneRepository {
  findById(
    organizationId: OrganizationId,
    deliveryZoneId: string,
  ): Promise<DeliveryZone | undefined>;
  /** ACTIVE only; the partial unique index guarantees at most one. */
  findActiveByAreaCode(input: {
    readonly organizationId: OrganizationId;
    readonly areaCode: string;
  }): Promise<DeliveryZone | undefined>;
  list(input: {
    readonly organizationId: OrganizationId;
    readonly page: number;
    readonly limit: number;
  }): Promise<DeliveryZonePage>;
  insert(zone: DeliveryZone): Promise<void>;
  /** Throws 409 CONFLICT for a stale version, like OrderRepository.update. */
  update(zone: DeliveryZone, expectedVersion: number): Promise<DeliveryZone>;
}
