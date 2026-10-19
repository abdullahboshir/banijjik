import type { OrganizationId } from "@banijjik/ids";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import { toStockMovementResponse } from "../inventory-views.js";

export class ListStockMovementsUseCase {
  constructor(private readonly dependencies: Pick<InventoryDependencies, "movements">) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly inventoryItemId?: string;
    readonly locationId?: string;
    readonly from?: Date;
    readonly to?: Date;
    readonly page: number;
    readonly limit: number;
  }): Promise<{
    readonly items: ReturnType<typeof toStockMovementResponse>[];
    readonly hasNext: boolean;
  }> {
    const result = await this.dependencies.movements.list(input);
    return {
      items: result.items.map(toStockMovementResponse),
      hasNext: result.total > input.page * input.limit,
    };
  }
}
