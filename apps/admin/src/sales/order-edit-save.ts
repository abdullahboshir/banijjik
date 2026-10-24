import type { CurrencyCode } from "@banijjik/contracts";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import { orderApprovalSubject, type OrderResponse } from "@banijjik/contracts/sales";
import type { OrderLineInputBody } from "@banijjik/validation/sales";
import { quoteOrder, updateOrder } from "./order-api";
import type { OrderApprovalFlow } from "./order-approval";
import { updateBodyOf, type EditValues } from "./order-edit-model";
import { manualDiscountTotalOf, quoteLinesOf } from "./order-lines";

export interface SaveOrderEditInput {
  readonly organizationId: string;
  readonly order: OrderResponse;
  readonly currency: CurrencyCode;
  readonly values: EditValues;
  readonly lineInputs: readonly OrderLineInputBody[];
  readonly nextDiscount: ManualDiscount | undefined;
  readonly contactId: string | null;
  readonly approval: OrderApprovalFlow;
  readonly onSaved: () => void;
}

/**
 * Saves the edit. A fresh quote gives the manual discount the approver signs off; when the API
 * answers `403 APPROVAL_REQUIRED` the approval flow asks for a PIN and resends the same body.
 */
export async function saveOrderEdit(input: SaveOrderEditInput): Promise<void> {
  const { order, organizationId } = input;
  const body = updateBodyOf(input);
  const fresh = await quoteOrder(organizationId, {
    locationId: order.locationId,
    lines: quoteLinesOf(input.lineInputs),
    ...(input.nextDiscount === undefined ? {} : { orderDiscount: input.nextDiscount }),
  });
  await input.approval.attempt(
    {
      subjectKey: orderApprovalSubject(order.orderId),
      locationId: order.locationId,
      amount: { amount: manualDiscountTotalOf(fresh), currency: input.currency },
    },
    async (approvalToken) => {
      await updateOrder(organizationId, order.orderId, {
        ...body,
        ...(approvalToken === undefined ? {} : { approvalToken }),
      });
    },
    input.onSaved,
  );
}
