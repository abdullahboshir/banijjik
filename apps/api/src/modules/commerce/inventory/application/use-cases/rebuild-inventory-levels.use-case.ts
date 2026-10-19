import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { InventoryItemId, OrganizationId, UserId } from "@banijjik/ids";
import type { ProjectedLevel } from "../level-projection.js";
import { projectLevelsFromMovements } from "../level-projection.js";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import { compareProjectedToStored, type LevelDifference } from "./rebuild-level-differences.js";

export class RebuildInventoryLevelsUseCase {
  constructor(private readonly dependencies: InventoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly locationId?: string;
    readonly fix: boolean;
  }): Promise<{
    readonly differenceCount: number;
    readonly differences: readonly LevelDifference[];
    readonly fixed: boolean;
  }> {
    const { movements, levels, unitOfWork, audit, clock, currency } = this.dependencies;
    const orgCurrency = await currency.read(input.organizationId);
    const allMovements = await movements.listAllForOrganization(
      input.organizationId,
      input.locationId,
    );
    const projected = projectLevelsFromMovements(allMovements);
    const stored = await levels.listForOrganization(input.organizationId, input.locationId);
    const differences = compareProjectedToStored(projected, stored);
    if (input.fix && differences.length > 0) {
      await unitOfWork.run(async () => {
        await applyProjectedLevels({
          projected,
          levels,
          organizationId: input.organizationId,
          orgCurrency,
          now: clock.now(),
        });
        await audit.record({
          action: AUDIT_ACTION.INVENTORY_LEVELS_REBUILT,
          entityType: AUDIT_ENTITY_TYPE.inventoryItem,
          entityId: input.organizationId,
          changes: { differenceCount: { to: differences.length }, fix: { to: true } },
        });
      });
    }
    return {
      differenceCount: differences.length,
      differences,
      fixed: input.fix && differences.length > 0,
    };
  }
}

async function applyProjectedLevels(input: {
  readonly projected: Map<string, ProjectedLevel>;
  readonly levels: InventoryDependencies["levels"];
  readonly organizationId: OrganizationId;
  readonly orgCurrency: string;
  readonly now: Date;
}): Promise<void> {
  for (const [key, expected] of input.projected) {
    const [locationId, inventoryItemId] = key.split(":");
    const existing = await input.levels.findOne({
      organizationId: input.organizationId,
      locationId: locationId as string,
      inventoryItemId: inventoryItemId as InventoryItemId,
    });
    const base =
      existing ??
      input.levels.newLevel({
        organizationId: input.organizationId,
        locationId: locationId as string,
        inventoryItemId: inventoryItemId as InventoryItemId,
        currency: input.orgCurrency,
        now: input.now,
      });
    const next = {
      ...base,
      onHand: expected.onHand,
      damaged: expected.damaged,
      averageUnitCostMicros: expected.averageUnitCostMicros,
      updatedAt: input.now,
      version: base.version + 1,
    };
    await input.levels.saveExpectedVersion(next, base.version);
  }
}
