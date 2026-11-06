import type { ManualCourierKey } from "@banijjik/contracts/courier";
import { asId, type LocationId, type OrderId, type OrganizationId } from "@banijjik/ids";
import { forbidden } from "../../../../../kernel/http/index.js";
import type { ConsignmentPage } from "../../domain/courier-repository.js";
import type { CourierDependencies } from "../courier-dependencies.js";

export interface ListConsignmentsInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly orderId?: string | undefined;
  readonly courierKey?: ManualCourierKey | undefined;
  readonly locationId?: string | undefined;
  readonly page: number;
  readonly limit: number;
}

export class ListConsignmentsUseCase {
  constructor(private readonly dependencies: CourierDependencies) {}

  async execute(input: ListConsignmentsInput): Promise<ConsignmentPage> {
    if (input.locationId !== undefined && input.allowedLocationIds !== "ALL") {
      if (!input.allowedLocationIds.includes(input.locationId)) throw forbidden();
    }

    return this.dependencies.consignments.list({
      organizationId: input.organizationId,
      orderId: input.orderId === undefined ? undefined : asId<OrderId>(input.orderId),
      courierKey: input.courierKey,
      locationId: input.locationId === undefined ? undefined : asId<LocationId>(input.locationId),
      page: input.page,
      limit: input.limit,
    });
  }
}
