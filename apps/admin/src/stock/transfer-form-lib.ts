import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import type { FieldErrors } from "../auth/field-errors";
import { transferStock } from "./stock-api";

export interface TransferLine {
  key: string;
  item: InventoryItemListItem | undefined;
  quantity: string;
}

export function emptyTransferLine(key: string): TransferLine {
  return { key, item: undefined, quantity: "" };
}

export function validateTransfer(
  fromLocationId: string,
  toLocationId: string,
  lines: TransferLine[],
): { ok: true; body: Parameters<typeof transferStock>[1] } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (fromLocationId.trim() === "") errors["fromLocationId"] = "validation.required";
  if (toLocationId.trim() === "") errors["toLocationId"] = "validation.required";
  if (fromLocationId === toLocationId) errors["toLocationId"] = "validation.invalid_value";
  const parsed = lines.map((line, index) => {
    const prefix = `line-${index}`;
    if (line.item === undefined) errors[`${prefix}-item`] = "validation.required";
    const quantity = Number(line.quantity.trim());
    if (!Number.isInteger(quantity) || quantity <= 0)
      errors[`${prefix}-quantity`] = "validation.invalid_format";
    if (line.item === undefined) return undefined;
    return { inventoryItemId: line.item.inventoryItemId, quantity };
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const valid = parsed.filter((line): line is NonNullable<typeof line> => line !== undefined);
  if (valid.length === 0) return { ok: false, errors: { lines: "validation.required" } };
  return { ok: true, body: { fromLocationId, toLocationId, lines: valid } };
}
