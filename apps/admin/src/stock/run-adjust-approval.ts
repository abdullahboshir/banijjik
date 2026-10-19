import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { StockAdjustmentBody } from "@banijjik/validation/inventory";
import { ApiError } from "../lib/api/api-error";
import { grantApproval } from "./stock-api";

export async function runAdjustApproval(props: {
  organizationId: string;
  pendingBody: StockAdjustmentBody;
  input: { approverMemberId: string; pin: string };
  postAdjustment: (body: StockAdjustmentBody) => Promise<void>;
}): Promise<{ ok: true } | { ok: false; errorKey: string; locked: boolean }> {
  try {
    const grant = await grantApproval(props.organizationId, {
      action: APPROVAL_ACTION.STOCK_ADJUSTMENT,
      subjectKey: props.pendingBody.locationId,
      locationId: props.pendingBody.locationId,
      approverMemberId: props.input.approverMemberId,
      pin: props.input.pin,
    });
    await props.postAdjustment({ ...props.pendingBody, approvalToken: grant.approvalToken });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        errorKey: error.messageKey,
        locked: error.code === ERROR_CODE.APPROVAL_PIN_LOCKED,
      };
    }
    throw error;
  }
}
