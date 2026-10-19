import { ERROR_CODE } from "@banijjik/contracts";
import type { StockAdjustmentBody } from "@banijjik/validation/inventory";
import type { FieldErrors } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import type { AdjustLine } from "./adjust-stock-form-lib";
import { validateAdjustLines } from "./adjust-stock-form-lib";
import { adjustStock, listApprovers } from "./stock-api";

export async function buildAdjustStockSend(props: {
  organizationId: string;
  locationId: string;
  lines: AdjustLine[];
  postAdjustment: (body: StockAdjustmentBody) => Promise<void>;
  onSuccess?: () => void;
  onApprovalRequired: (
    body: StockAdjustmentBody,
    approvers: Awaited<ReturnType<typeof listApprovers>>,
  ) => void;
}): Promise<{ ok: true } | { ok: false; fieldErrors: FieldErrors }> {
  if (props.locationId.trim() === "") {
    return { ok: false, fieldErrors: { locationId: "validation.required" } };
  }
  const built = validateAdjustLines(props.lines);
  if (!built.ok) return { ok: false, fieldErrors: built.errors };
  const body: StockAdjustmentBody = { locationId: props.locationId, lines: built.body };
  try {
    await props.postAdjustment(body);
    props.onSuccess?.();
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError && error.code === ERROR_CODE.APPROVAL_REQUIRED) {
      const approvers = await listApprovers(props.organizationId, props.locationId);
      props.onApprovalRequired(body, approvers);
      return { ok: false, fieldErrors: {} };
    }
    throw error;
  }
}

export async function postStockAdjustment(
  organizationId: string,
  body: StockAdjustmentBody,
): Promise<void> {
  await adjustStock(organizationId, body);
}
