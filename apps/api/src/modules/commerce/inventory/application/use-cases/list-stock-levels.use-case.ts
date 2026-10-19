import type { OrganizationId } from "@banijjik/ids";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import { toInventoryLevelRow } from "../inventory-views.js";
import { assertLocationReach } from "./stock-use-case-shared.js";

export class ListStockLevelsUseCase {
  constructor(private readonly dependencies: Pick<InventoryDependencies, "levels">) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId: string;
    readonly q?: string;
    readonly lowOnly?: boolean;
    readonly page: number;
    readonly limit: number;
  }): Promise<{
    readonly items: ReturnType<typeof toInventoryLevelRow>[];
    readonly hasNext: boolean;
  }> {
    assertLocationReach(input.allowedLocationIds, input.locationId);
    const { rows, total } = await this.dependencies.levels.listWithItems({
      organizationId: input.organizationId,
      locationId: input.locationId,
      ...(input.q === undefined ? {} : { q: input.q }),
      ...(input.lowOnly === undefined ? {} : { lowOnly: input.lowOnly }),
      page: input.page,
      limit: input.limit,
    });
    return {
      items: rows.map((row) => toInventoryLevelRow(row)),
      hasNext: total > input.page * input.limit,
    };
  }
}
