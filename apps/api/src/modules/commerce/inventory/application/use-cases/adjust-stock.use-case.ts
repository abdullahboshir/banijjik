import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  INVENTORY_EVENT_TYPE,
  STOCK_ADJUSTMENT_REASON,
  STOCK_MOVEMENT_REASON,
  type StockAdjustmentReason,
} from "@banijjik/contracts/inventory";
import { newId, type InventoryItemId, type OrganizationId, type UserId } from "@banijjik/ids";
import { AppError } from "../../../../../kernel/http/index.js";
import type { InventoryDependencies } from "../inventory-dependencies.js";
import {
  assertLocationReach,
  loadStockLineItem,
  requireActiveLocation,
  SOURCE_ADJUSTMENT,
} from "./stock-use-case-shared.js";

function adjustmentNeedsApproval(
  approvalAbove: number,
  lines: readonly { readonly quantityDelta: number }[],
): boolean {
  if (approvalAbove <= 0) return false;
  const negativeTotal = lines
    .filter((line) => line.quantityDelta < 0)
    .reduce((sum, line) => sum + Math.abs(line.quantityDelta), 0);
  return (
    negativeTotal > approvalAbove ||
    lines.some((line) => line.quantityDelta < 0 && Math.abs(line.quantityDelta) > approvalAbove)
  );
}

async function checkAdjustmentApproval(input: {
  readonly deps: InventoryDependencies;
  readonly organizationId: OrganizationId;
  readonly lines: readonly { readonly quantityDelta: number }[];
  readonly approvalToken?: string | undefined;
}): Promise<boolean> {
  const approvalAbove = await input.deps.settings.adjustmentApprovalAbove(input.organizationId);
  const needsApproval = adjustmentNeedsApproval(approvalAbove, input.lines);
  if (needsApproval && input.approvalToken === undefined) {
    throw new AppError({
      code: ERROR_CODE.APPROVAL_REQUIRED,
      messageKey: "errors.approval_required",
      details: { action: APPROVAL_ACTION.STOCK_ADJUSTMENT },
    });
  }
  return needsApproval;
}

export class AdjustStockUseCase {
  constructor(private readonly dependencies: InventoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly locationId: string;
    readonly approvalToken?: string;
    readonly lines: readonly {
      readonly inventoryItemId: InventoryItemId;
      readonly quantityDelta: number;
      readonly reason: StockAdjustmentReason;
      readonly note?: string;
    }[];
  }): Promise<{ readonly sourceId: string }> {
    const deps = this.dependencies;
    assertLocationReach(input.allowedLocationIds, input.locationId);
    await requireActiveLocation(deps.locations, input.locationId);
    const needsApproval = await checkAdjustmentApproval({
      deps,
      organizationId: input.organizationId,
      lines: input.lines,
      approvalToken: input.approvalToken,
    });
    const currency = await deps.currency.read(input.organizationId);
    const allowNegativeStock = await deps.settings.allowNegativeStock(input.organizationId);
    const prepared = await Promise.all(
      input.lines.map(async (line) => ({
        line,
        ...(await loadStockLineItem(deps, input.organizationId, line.inventoryItemId)),
      })),
    );
    const sourceId = newId();
    return deps.unitOfWork.run(async () => {
      if (needsApproval && input.approvalToken !== undefined) {
        await deps.approvals.consume(input.approvalToken, {
          action: APPROVAL_ACTION.STOCK_ADJUSTMENT,
          subjectKey: input.locationId,
        });
      }
      await applyStockAdjustments({
        deps,
        input,
        prepared,
        currency,
        allowNegativeStock,
        sourceId,
      });
      await deps.events.publish(INVENTORY_EVENT_TYPE.STOCK_SOURCE_RECORDED, {
        sourceType: SOURCE_ADJUSTMENT,
        sourceId,
      });
      await deps.audit.record({
        action: AUDIT_ACTION.STOCK_ADJUSTED,
        entityType: AUDIT_ENTITY_TYPE.stockMovement,
        entityId: sourceId,
        changes: { locationId: { to: input.locationId } },
      });
      return { sourceId };
    });
  }
}

async function applyStockAdjustments(input: {
  readonly deps: InventoryDependencies;
  readonly input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly locationId: string;
  };
  readonly prepared: readonly {
    readonly line: {
      readonly quantityDelta: number;
      readonly reason: StockAdjustmentReason;
      readonly note?: string;
    };
    readonly item: Awaited<ReturnType<typeof loadStockLineItem>>["item"];
    readonly threshold: number;
  }[];
  readonly currency: string;
  readonly allowNegativeStock: boolean;
  readonly sourceId: string;
}): Promise<void> {
  for (const row of input.prepared) {
    const reason =
      row.line.reason === STOCK_ADJUSTMENT_REASON.DAMAGE_WRITE_OFF
        ? STOCK_MOVEMENT_REASON.DAMAGE_WRITE_OFF
        : STOCK_MOVEMENT_REASON.ADJUSTMENT;
    await input.deps.stockLedger.applyMovement({
      organizationId: input.input.organizationId,
      actorUserId: input.input.actorUserId,
      locationId: input.input.locationId,
      inventoryItem: row.item,
      currency: input.currency,
      quantityDelta: row.line.quantityDelta,
      reason,
      sourceType: SOURCE_ADJUSTMENT,
      sourceId: input.sourceId,
      ...(row.line.note === undefined ? {} : { note: row.line.note }),
      lowStockThreshold: row.threshold,
      allowNegativeStock: input.allowNegativeStock,
    });
  }
}
