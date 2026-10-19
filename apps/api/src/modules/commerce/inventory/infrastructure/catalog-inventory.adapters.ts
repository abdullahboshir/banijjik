import { MAX_STOCK_COMPONENTS } from "@banijjik/contracts/catalog";
import type { StockComponent } from "@banijjik/contracts/catalog";
import type { InventoryItemId, OrganizationId, UserId } from "@banijjik/ids";
import { MongoUnitOfWork } from "../../../../kernel/db/index.js";
import type { DefaultStockItemPort, InventoryComponentsPort } from "../../catalog/index.js";
import { InventoryItem } from "../domain/inventory-item.entity.js";
import { invalidStockComponent } from "../domain/errors.js";
import { MongoInventoryItemRepository } from "./mongo-inventory-item.repository.js";

export function buildInventoryCatalogPorts(): {
  readonly inventoryComponents: InventoryComponentsPort;
  readonly defaultStockItems: DefaultStockItemPort;
} {
  const items = new MongoInventoryItemRepository();
  const unitOfWork = new MongoUnitOfWork();
  return {
    inventoryComponents: new InventoryComponentsAdapter(items),
    defaultStockItems: new DefaultStockItemAdapter(items, unitOfWork),
  };
}

class InventoryComponentsAdapter implements InventoryComponentsPort {
  constructor(private readonly items: MongoInventoryItemRepository) {}

  async assertComponentsValid(
    organizationId: OrganizationId,
    components: readonly StockComponent[],
    pathPrefix: string,
  ): Promise<void> {
    if (components.length > MAX_STOCK_COMPONENTS) {
      throw invalidStockComponent(pathPrefix);
    }
    for (let index = 0; index < components.length; index += 1) {
      const component = components[index];
      if (component === undefined || component.quantity <= 0) {
        throw invalidStockComponent(`${pathPrefix}.${index}`);
      }
      const item = await this.items.findById(component.inventoryItemId as InventoryItemId);
      if (item === undefined || item.organizationId !== organizationId || !item.isActive()) {
        throw invalidStockComponent(`${pathPrefix}.${index}.inventoryItemId`);
      }
    }
  }
}

class DefaultStockItemAdapter implements DefaultStockItemPort {
  constructor(
    private readonly items: MongoInventoryItemRepository,
    private readonly unitOfWork: MongoUnitOfWork,
  ) {}

  async createDefaultLinkedItem(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly offeringName: string;
    readonly variantName: string;
    readonly baseUnitKey: string;
  }): Promise<{ readonly inventoryItemId: InventoryItemId }> {
    return this.unitOfWork.run(async () => {
      const now = new Date();
      const item = InventoryItem.create({
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        name: `${input.offeringName} — ${input.variantName}`,
        baseUnitKey: input.baseUnitKey as InventoryItem["baseUnitKey"],
        now,
      });
      await this.items.insert(item);
      return { inventoryItemId: item.inventoryItemId };
    });
  }
}
