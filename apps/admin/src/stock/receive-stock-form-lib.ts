import type { CurrencyCode } from "@banijjik/contracts";
import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import { moneyFromInput } from "@banijjik/web-client";
import type { FieldErrors } from "../auth/field-errors";
import { receiveStock } from "./stock-api";

export interface ReceiptLine {
  key: string;
  item: InventoryItemListItem | undefined;
  quantity: string;
  unitCost: string;
}

export function emptyReceiptLine(key: string): ReceiptLine {
  return { key, item: undefined, quantity: "", unitCost: "" };
}

export function validateReceiptLines(
  lines: ReceiptLine[],
  currency: CurrencyCode,
  locationId: string,
): { ok: true; body: Parameters<typeof receiveStock>[1] } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (locationId.trim() === "") errors["locationId"] = "validation.required";
  const parsed = lines.map((line, index) => {
    const prefix = `line-${index}`;
    if (line.item === undefined) errors[`${prefix}-item`] = "validation.required";
    const quantity = Number(line.quantity.trim());
    if (!Number.isInteger(quantity) || quantity <= 0)
      errors[`${prefix}-quantity`] = "validation.invalid_format";
    const unitCost = moneyFromInput(line.unitCost, currency);
    if (unitCost === undefined) errors[`${prefix}-unitCost`] = "validation.invalid_format";
    if (line.item === undefined || unitCost === undefined) return undefined;
    return { inventoryItemId: line.item.inventoryItemId, quantity, unitCost };
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const valid = parsed.filter((line): line is NonNullable<typeof line> => line !== undefined);
  if (valid.length === 0) return { ok: false, errors: { lines: "validation.required" } };
  return { ok: true, body: { locationId, lines: valid } };
}
