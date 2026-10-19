import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import { STOCK_ADJUSTMENT_REASON } from "@banijjik/contracts/inventory";
import type { StockAdjustmentBody } from "@banijjik/validation/inventory";
import type { FieldErrors } from "../auth/field-errors";

export interface AdjustLine {
  key: string;
  item: InventoryItemListItem | undefined;
  quantityDelta: string;
  reason: (typeof STOCK_ADJUSTMENT_REASON)[keyof typeof STOCK_ADJUSTMENT_REASON];
  note: string;
}

export function emptyAdjustLine(key: string): AdjustLine {
  return {
    key,
    item: undefined,
    quantityDelta: "",
    reason: STOCK_ADJUSTMENT_REASON.ADJUSTMENT,
    note: "",
  };
}

export function validateAdjustLines(
  lines: AdjustLine[],
): { ok: true; body: StockAdjustmentBody["lines"] } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const parsed = lines.map((line, index) => {
    const prefix = `line-${index}`;
    if (line.item === undefined) errors[`${prefix}-item`] = "validation.required";
    const quantityDelta = Number(line.quantityDelta.trim());
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
      errors[`${prefix}-quantityDelta`] = "validation.invalid_format";
    }
    if (line.item === undefined) return undefined;
    return {
      inventoryItemId: line.item.inventoryItemId,
      quantityDelta,
      reason: line.reason,
      ...(line.note.trim() ? { note: line.note.trim() } : {}),
    };
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const valid = parsed.filter((line): line is NonNullable<typeof line> => line !== undefined);
  if (valid.length === 0) return { ok: false, errors: { lines: "validation.required" } };
  return { ok: true, body: valid };
}
