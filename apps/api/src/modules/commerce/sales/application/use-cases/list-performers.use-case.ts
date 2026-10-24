import { MAX_ORDER_PERFORMERS, type SalesPerformerResponse } from "@banijjik/contracts/sales";
import type { SalesDependencies } from "../sales-dependencies.js";
import { assertLocationAllowed } from "../sales-transition-shared.js";
import type { OrderWriteInput } from "./create-order.use-case.js";

export interface PerformersQuery {
  readonly locationId: string;
}

/**
 * The performer picker of the order screen (plan 3.11 Refresh C). A cashier usually cannot read
 * the staff list, so this narrow read returns names only, for the caller's own locations.
 */
export class ListPerformersUseCase {
  constructor(private readonly dependencies: Pick<SalesDependencies, "performers">) {}

  async execute(
    input: Pick<OrderWriteInput, "allowedLocationIds"> & { readonly query: PerformersQuery },
  ): Promise<readonly SalesPerformerResponse[]> {
    assertLocationAllowed(input.query.locationId, input.allowedLocationIds);
    const names = await this.dependencies.performers.listAt(
      input.query.locationId,
      MAX_ORDER_PERFORMERS,
    );
    return names.map((entry) => ({ memberId: entry.memberId, name: entry.name }));
  }
}
