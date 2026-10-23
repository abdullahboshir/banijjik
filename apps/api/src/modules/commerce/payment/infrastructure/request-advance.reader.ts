import { ERROR_CODE } from "@banijjik/contracts";
import { REVENUE_STATE } from "@banijjik/contracts/accounting";
import {
  PAYMENT_DIRECTION,
  type Money,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import type { OrganizationId } from "@banijjik/ids";
import { models } from "../../../../kernel/db/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import type { RequestAdvanceReader } from "../application/ports/request-advance-reader.js";
import { PAYMENT_MODEL_NAME, type PaymentDocument } from "./payment.schema.js";

function allocationDelta(direction: string, amount: number): number {
  if (direction === PAYMENT_DIRECTION.IN) return amount;
  if (direction === PAYMENT_DIRECTION.REFUND || direction === PAYMENT_DIRECTION.REVERSAL) {
    return -amount;
  }
  return 0;
}

/**
 * Net BEFORE_REVENUE money the request holds on the payments themselves (the payment summary
 * also counts AFTER_REVENUE allocations, so it cannot answer this). Never below zero.
 * The compound index `{ organizationId: 1, "allocations.requestType": 1, "allocations.requestId": 1 }`
 * serves the query, and the read uses it with a projection.
 */
async function readHeldAdvance(input: {
  readonly organizationId: OrganizationId;
  readonly requestType: PaymentRequestType;
  readonly requestId: string;
  readonly currency: Money["currency"];
}): Promise<Money> {
  const docs = await models({})
    .get<PaymentDocument>(PAYMENT_MODEL_NAME)
    .find(
      {
        organizationId: input.organizationId,
        "allocations.requestType": input.requestType,
        "allocations.requestId": input.requestId,
      },
      { direction: 1, allocations: 1, _id: 0 },
    )
    .lean<Pick<PaymentDocument, "direction" | "allocations">[]>();

  let netMinor = 0;
  for (const doc of docs) {
    for (const alloc of doc.allocations ?? []) {
      const isTarget =
        alloc.requestType === input.requestType &&
        alloc.requestId === input.requestId &&
        alloc.revenueState === REVENUE_STATE.BEFORE_REVENUE;
      if (!isTarget) continue;
      if (alloc.amount.currency !== input.currency) throw currencyMismatch();
      netMinor += allocationDelta(doc.direction, alloc.amount.amount);
    }
  }

  return { amount: Math.max(0, netMinor), currency: input.currency };
}

function currencyMismatch(): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
}

export function buildRequestAdvanceReader(): RequestAdvanceReader {
  return { readHeldAdvance };
}
