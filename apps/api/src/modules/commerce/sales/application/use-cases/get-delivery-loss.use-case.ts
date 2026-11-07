import type {
  DeliveryLossClosureResponse,
  DeliveryLossRecoveryResponse,
} from "@banijjik/contracts/sales/delivery";
import type { OrderId, OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";
import {
  toDeliveryLossClosureResponse,
  toDeliveryLossRecoveryResponse,
} from "../sales-views.js";

export interface GetDeliveryLossInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly orderId: OrderId;
}

export interface GetDeliveryLossResult {
  readonly closure: DeliveryLossClosureResponse;
  readonly recoveries: readonly DeliveryLossRecoveryResponse[];
}

export class GetDeliveryLossUseCase {
  constructor(private readonly dependencies: SalesDependencies) {}

  async execute(input: GetDeliveryLossInput): Promise<GetDeliveryLossResult> {
    const closure = await this.dependencies.deliveryLosses.findClosureByOrderId(
      input.organizationId,
      input.orderId,
    );
    if (!closure) throw recordNotFound();
    assertLocationAllowed(closure.locationId, input.allowedLocationIds);

    const recoveries = await this.dependencies.deliveryLosses.listRecoveries(
      input.organizationId,
      closure.deliveryLossClosureId,
    );

    return {
      closure: toDeliveryLossClosureResponse(closure),
      recoveries: recoveries.map((r) => toDeliveryLossRecoveryResponse(r)),
    };
  }
}
