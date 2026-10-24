import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  INVENTORY_EVENT_TYPE,
  STOCK_MOVEMENT_REASON,
  type StockReceiptPaidVia,
} from "@banijjik/contracts/inventory";
import type { Money } from "@banijjik/contracts/catalog";
import { newId, type InventoryItemId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import {
  assertLocationReach,
  loadReceiptLine,
  requireActiveLocation,
  SOURCE_RECEIPT,
} from "./stock-use-case-shared.js";

export class ReceiveStockUseCase {
  constructor(private readonly dependencies: InventoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId: string;
    readonly paidVia: StockReceiptPaidVia;
    readonly supplierNote?: string;
    readonly lines: readonly {
      readonly inventoryItemId: InventoryItemId;
      readonly quantity: number;
      readonly unitCost: Money;
    }[];
  }): Promise<{ readonly sourceId: string }> {
    const deps = this.dependencies;
    assertLocationReach(input.allowedLocationIds, input.locationId);
    await requireActiveLocation(deps.locations, input.locationId);
    const currency = await deps.currency.read(input.organizationId);
    const timeZone = await deps.timeZone.read(input.organizationId);
    const allowNegativeStock = await deps.settings.allowNegativeStock(input.organizationId);
    const prepared = await Promise.all(
      input.lines.map((line) =>
        loadReceiptLine({ deps, organizationId: input.organizationId, line, currency }),
      ),
    );
    const sourceId = newId();
    return deps.unitOfWork.run(async () => {
      for (const row of prepared) {
        await deps.stockLedger.applyMovement({
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          locationId: input.locationId,
          inventoryItem: row.item,
          currency,
          timeZone,
          quantityDelta: row.line.quantity,
          reason: STOCK_MOVEMENT_REASON.PURCHASE,
          sourceType: SOURCE_RECEIPT,
          sourceId,
          ...(input.supplierNote === undefined ? {} : { note: input.supplierNote }),
          paidVia: input.paidVia,
          unitCost: row.line.unitCost,
          lowStockThreshold: row.threshold,
          allowNegativeStock,
        });
      }
      await recordReceipt({
        deps,
        sourceId,
        locationId: input.locationId,
        lines: input.lines,
        paidVia: input.paidVia,
      });
      return { sourceId };
    });
  }
}

async function recordReceipt(input: {
  readonly deps: InventoryDependencies;
  readonly sourceId: string;
  readonly locationId: string;
  readonly lines: readonly unknown[];
  readonly paidVia: StockReceiptPaidVia;
}): Promise<void> {
  await input.deps.events.publish(INVENTORY_EVENT_TYPE.STOCK_SOURCE_RECORDED, {
    sourceType: SOURCE_RECEIPT,
    sourceId: input.sourceId,
  });
  await input.deps.audit.record({
    action: AUDIT_ACTION.STOCK_RECEIVED,
    entityType: AUDIT_ENTITY_TYPE.stockMovement,
    entityId: input.sourceId,
    changes: {
      locationId: { to: input.locationId },
      lineCount: { to: input.lines.length },
      paidVia: { to: input.paidVia },
    },
  });
}
