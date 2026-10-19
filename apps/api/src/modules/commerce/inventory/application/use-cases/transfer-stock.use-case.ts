import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import { INVENTORY_EVENT_TYPE, STOCK_MOVEMENT_REASON } from "@banijjik/contracts/inventory";
import type { Money } from "@banijjik/contracts/catalog";
import { newId, type InventoryItemId, type OrganizationId, type UserId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import { microsToMinor } from "../../domain/money-math.js";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import { stockOrderingKey } from "../stock-ordering-key.js";
import {
  assertLocationReach,
  loadStockLineItem,
  requireActiveLocation,
  SOURCE_TRANSFER,
} from "./stock-use-case-shared.js";

type TransferLine = { readonly inventoryItemId: InventoryItemId; readonly quantity: number };

type PreparedTransferLine = {
  readonly line: TransferLine;
  readonly item: Awaited<ReturnType<typeof loadStockLineItem>>["item"];
  readonly threshold: number;
  readonly unitCost: Money;
  readonly unitCostMicros: number;
};

async function loadTransferLine(input: {
  readonly deps: InventoryDependencies;
  readonly organizationId: OrganizationId;
  readonly fromLocationId: string;
  readonly line: TransferLine;
  readonly currency: string;
}): Promise<PreparedTransferLine> {
  const { item, threshold } = await loadStockLineItem(
    input.deps,
    input.organizationId,
    input.line.inventoryItemId,
  );
  const fromLevel = await input.deps.levels.findOne({
    organizationId: input.organizationId,
    locationId: input.fromLocationId,
    inventoryItemId: input.line.inventoryItemId,
  });
  const unitCostMicros = fromLevel?.averageUnitCostMicros ?? 0;
  const unitCost = {
    amount: microsToMinor(unitCostMicros),
    currency: (fromLevel?.averageUnitCostCurrency ?? input.currency) as Money["currency"],
  };
  return { line: input.line, item, threshold, unitCost, unitCostMicros };
}

export class TransferStockUseCase {
  constructor(private readonly dependencies: InventoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly fromLocationId: string;
    readonly toLocationId: string;
    readonly lines: readonly TransferLine[];
  }): Promise<{ readonly transferNumber: string }> {
    const deps = this.dependencies;
    assertLocationReach(input.allowedLocationIds, input.fromLocationId);
    assertLocationReach(input.allowedLocationIds, input.toLocationId);
    await requireActiveLocation(deps.locations, input.fromLocationId);
    await requireActiveLocation(deps.locations, input.toLocationId);
    if (input.fromLocationId === input.toLocationId) {
      throw new AppError({
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: "validation.invalid_value",
      });
    }
    const currency = await deps.currency.read(input.organizationId);
    const allowNegativeStock = await deps.settings.allowNegativeStock(input.organizationId);
    const transferNumber = await deps.sequences.nextTransferNumber(input.organizationId);
    const prepared = await Promise.all(
      input.lines.map((line) =>
        loadTransferLine({
          deps,
          organizationId: input.organizationId,
          fromLocationId: input.fromLocationId,
          line,
          currency,
        }),
      ),
    );
    const sourceId = newId();
    return deps.unitOfWork.run(() =>
      commitTransfer({
        deps,
        input,
        prepared,
        currency,
        allowNegativeStock,
        transferNumber,
        sourceId,
      }),
    );
  }
}

async function commitTransfer(input: {
  readonly deps: InventoryDependencies;
  readonly input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly fromLocationId: string;
    readonly toLocationId: string;
    readonly lines: readonly TransferLine[];
  };
  readonly prepared: readonly PreparedTransferLine[];
  readonly currency: string;
  readonly allowNegativeStock: boolean;
  readonly transferNumber: string;
  readonly sourceId: string;
}): Promise<{ readonly transferNumber: string }> {
  for (const row of input.prepared) {
    await applyTransferLine({
      deps: input.deps,
      input: input.input,
      row,
      currency: input.currency,
      allowNegativeStock: input.allowNegativeStock,
      transferNumber: input.transferNumber,
      sourceId: input.sourceId,
    });
  }
  await input.deps.events.publish(
    INVENTORY_EVENT_TYPE.TRANSFER_COMPLETED,
    {
      transferNumber: input.transferNumber,
      fromLocationId: input.input.fromLocationId,
      toLocationId: input.input.toLocationId,
    },
    {
      orderingKey: stockOrderingKey(
        input.input.fromLocationId,
        input.input.lines[0]?.inventoryItemId ?? "transfer",
      ),
    },
  );
  await input.deps.audit.record({
    action: AUDIT_ACTION.STOCK_TRANSFERRED,
    entityType: AUDIT_ENTITY_TYPE.stockTransfer,
    entityId: input.sourceId,
    changes: {
      transferNumber: { to: input.transferNumber },
      fromLocationId: { to: input.input.fromLocationId },
      toLocationId: { to: input.input.toLocationId },
    },
  });
  return { transferNumber: input.transferNumber };
}

async function applyTransferLine(input: {
  readonly deps: InventoryDependencies;
  readonly input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly fromLocationId: string;
    readonly toLocationId: string;
  };
  readonly row: PreparedTransferLine;
  readonly currency: string;
  readonly allowNegativeStock: boolean;
  readonly transferNumber: string;
  readonly sourceId: string;
}): Promise<void> {
  const movementBase = {
    organizationId: input.input.organizationId,
    actorUserId: input.input.actorUserId,
    inventoryItem: input.row.item,
    currency: input.currency,
    sourceType: SOURCE_TRANSFER,
    sourceId: input.sourceId,
    note: input.transferNumber,
    lowStockThreshold: input.row.threshold,
    allowNegativeStock: input.allowNegativeStock,
  };
  await input.deps.stockLedger.applyMovement({
    ...movementBase,
    locationId: input.input.fromLocationId,
    quantityDelta: -input.row.line.quantity,
    reason: STOCK_MOVEMENT_REASON.TRANSFER_OUT,
    unitCostMicros: input.row.unitCostMicros,
  });
  await input.deps.stockLedger.applyMovement({
    ...movementBase,
    locationId: input.input.toLocationId,
    quantityDelta: input.row.line.quantity,
    reason: STOCK_MOVEMENT_REASON.TRANSFER_IN,
    unitCost: input.row.unitCost,
    unitCostMicros: input.row.unitCostMicros,
  });
}
