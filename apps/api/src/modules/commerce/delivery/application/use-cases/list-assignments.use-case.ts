import type { DeliveryAssignmentListQuery } from "@banijjik/validation/delivery";
import { asId, type LocationId, type OrderId, type OrganizationId } from "@banijjik/ids";
import type { DeliveryAssignmentPage } from "../../domain/delivery-repository.js";
import type { DeliveryDependencies } from "../delivery-dependencies.js";

export interface ListAssignmentsInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly query: DeliveryAssignmentListQuery;
}

export class ListDeliveryAssignmentsUseCase {
  constructor(private readonly dependencies: DeliveryDependencies) {}

  async execute(input: ListAssignmentsInput): Promise<DeliveryAssignmentPage> {
    const { query } = input;
    let locationId: LocationId | undefined;
    if (query.locationId !== undefined) {
      locationId = asId<LocationId>(query.locationId);
    } else if (input.allowedLocationIds !== "ALL") {
      locationId = asId<LocationId>(input.allowedLocationIds[0] ?? "");
    }

    return this.dependencies.assignments.list({
      organizationId: input.organizationId,
      orderId: query.orderId !== undefined ? asId<OrderId>(query.orderId) : undefined,
      riderMemberId: query.riderMemberId,
      locationId,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
  }
}
