import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import type { QuoteResponse } from "@banijjik/contracts/pricing";
import {
  INSTANT_ORDER_APPROVAL_SUBJECT,
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesExchangePreviewResponse,
} from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import {
  EXCHANGE_DISCOUNT_APPROVAL_KEY,
  buildExchangeBody,
  type ExchangeBodyInput,
  canOfferExchange,
  clampPaymentMinor,
  clampedAmountText,
  discountApprovalOf,
  exchangeApprovalStepsOf,
  exchangeBlockerOf,
  exchangeMethodsFor,
  exchangePaymentBodiesOf,
  leftToPayMinor,
  minorToInputText,
  type ExchangePaymentDraft,
} from "./exchange-model";
import type { ReturnLineDraft } from "./return-model";

const ORDER_ID = "01900000-0000-7000-8000-000000000010";
const LINE_ID = "01900000-0000-7000-8000-000000000020";
const CURRENCY = "BDT";

function money(amount: number): { amount: number; currency: "BDT" } {
  return { amount, currency: CURRENCY };
}

/** The server's preview of an exchange: the order total, the credit spent and the credit left. */
function previewOf(input: {
  readonly total: number;
  readonly creditUsed: number;
  readonly creditLeft?: number;
  readonly due?: number;
}): SalesExchangePreviewResponse {
  return {
    salesReturn: {
      lines: [],
      deliveryChargeReturned: money(0),
      roundingReturned: money(0),
      value: money(4000),
      dueReduced: money(0),
      refundAmount: money(0),
      requiresRefundApproval: false,
      requiresNotReceivedApproval: false,
    },
    orderGrandTotal: money(input.total),
    storeCreditUsed: money(input.creditUsed),
    storeCreditLeft: money(input.creditLeft ?? 0),
    dueAmount: money(input.due ?? 0),
  };
}

function payment(
  draftId: string,
  amountText: string,
  method: ExchangePaymentDraft["method"] = PAYMENT_METHOD.CASH,
): ExchangePaymentDraft {
  return { draftId, method, amountText, reference: "" };
}

function pickedDraft(quantity: number): ReturnLineDraft {
  return {
    orderLineId: LINE_ID,
    nameSnapshot: "Rice 5 kg",
    soldQuantity: 2,
    remainingQuantity: 2,
    quantity,
    disposition: RETURN_DISPOSITION.RESTOCK,
  };
}

function newLine() {
  return {
    offeringId: "01900000-0000-7000-8000-000000000030",
    variantId: "01900000-0000-7000-8000-000000000031",
    quantity: 1,
    modifierOptionIds: [],
  };
}

function bodyInput(overrides: Partial<ExchangeBodyInput> = {}): ExchangeBodyInput {
  return {
    returnDrafts: [pickedDraft(1)],
    returnDeliveryCharge: false,
    reasonKey: SALES_RETURN_REASON.CHANGED_MIND,
    returnNote: "",
    lineInputs: [newLine()],
    orderDiscount: undefined,
    orderNote: "",
    payments: [],
    currency: CURRENCY,
    ...overrides,
  };
}

function orderWith(input: { contactId: string | null; status: string }): OrderResponse {
  return {
    orderId: ORDER_ID,
    locationId: "location-1",
    contactId: input.contactId,
    status: input.status,
    returnStatus: ORDER_RETURN_STATUS.NONE,
    businessDate: "2026-10-24",
    lines: [],
  } as unknown as OrderResponse;
}

describe("exchange payments", () => {
  it("caps a payment at what is left after the store credit and the other payments", () => {
    // Minor units: 4000 is 40.00, the credit 25.00; the other payment is typed as 10 (taka).
    const preview = previewOf({ total: 4000, creditUsed: 2500 });
    const payments = [payment("a", "10"), payment("b", "")];
    expect(leftToPayMinor(preview, payments, "b")).toBe(500);
    expect(clampPaymentMinor(9999, 500)).toBe(500);
  });

  it("never reports less than zero left to pay when the payments are above the total", () => {
    const preview = previewOf({ total: 1000, creditUsed: 0 });
    expect(leftToPayMinor(preview, [payment("a", "5000")], "b")).toBe(0);
  });

  it("clamps a typed amount to the cap and keeps a typed amount below it", () => {
    expect(clampedAmountText("9999", 500)).toBe("5");
    expect(clampedAmountText("3", 500)).toBe("3");
  });

  it("writes a whole amount without decimals and a fraction with two digits", () => {
    expect(minorToInputText(1200)).toBe("12");
    expect(minorToInputText(1250)).toBe("12.50");
  });

  it("sends only valid payment lines and a reference only for bKash and Nagad", () => {
    const bodies = exchangePaymentBodiesOf(
      [
        { draftId: "a", method: PAYMENT_METHOD.BKASH, amountText: "100", reference: " TX-1 " },
        { draftId: "b", method: PAYMENT_METHOD.CASH, amountText: "50", reference: "ignored" },
        { draftId: "c", method: PAYMENT_METHOD.CASH, amountText: "", reference: "" },
      ],
      CURRENCY,
    );
    expect(bodies).toEqual([
      { method: "BKASH", amount: money(10_000), externalReference: "TX-1" },
      { method: "CASH", amount: money(5000) },
    ]);
  });

  it("offers only the payment methods that an exchange takes", () => {
    expect(
      exchangeMethodsFor([PAYMENT_METHOD.CASH, PAYMENT_METHOD.STORE_CREDIT, PAYMENT_METHOD.BKASH]),
    ).toEqual([PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH]);
  });
});

describe("exchange body", () => {
  it("sends the return without a refund method, so the server pays the credit", () => {
    const body = buildExchangeBody(bodyInput());
    expect(body.return).not.toHaveProperty("refundMethod");
    expect(body.return).not.toHaveProperty("refundExternalReference");
    expect(body.order.lines).toEqual([newLine()]);
    expect(body.payments).toEqual([]);
  });

  it("sends the granted return and discount tokens under the names the server reads", () => {
    const body = buildExchangeBody(
      bodyInput({
        granted: { refund: "refund-token", [EXCHANGE_DISCOUNT_APPROVAL_KEY]: "discount-token" },
      }),
    );
    expect(body.return.approvalTokens).toEqual({ refund: "refund-token" });
    expect(body.order.approvalToken).toBe("discount-token");
  });

  it("omits a blank order note", () => {
    const body = buildExchangeBody(bodyInput({ orderNote: "   " }));
    expect(body.order).not.toHaveProperty("note");
  });
});

describe("exchange blockers", () => {
  const ready = {
    returnDrafts: [pickedDraft(1)],
    reasonKey: SALES_RETURN_REASON.CHANGED_MIND,
    returnNote: "",
    lineCount: 1,
    invalidLineCount: 0,
    payments: [],
    hasPreview: true,
  };

  it("asks for a returned line first, then a reason, then a note for Other", () => {
    expect(exchangeBlockerOf({ ...ready, returnDrafts: [pickedDraft(0)] })).toBe("NO_RETURN_LINES");
    expect(exchangeBlockerOf({ ...ready, reasonKey: undefined })).toBe("REASON");
    expect(exchangeBlockerOf({ ...ready, reasonKey: SALES_RETURN_REASON.OTHER })).toBe("NOTE");
  });

  it("asks for a valid new line before the payments and the server's numbers", () => {
    expect(exchangeBlockerOf({ ...ready, lineCount: 0 })).toBe("NO_NEW_LINES");
    expect(exchangeBlockerOf({ ...ready, invalidLineCount: 1 })).toBe("INVALID_NEW_LINES");
    expect(exchangeBlockerOf({ ...ready, hasPreview: false })).toBe("NO_PREVIEW");
  });

  it("asks for the transaction reference of a mobile money payment", () => {
    const withoutReference = [payment("a", "100", PAYMENT_METHOD.NAGAD)];
    expect(exchangeBlockerOf({ ...ready, payments: withoutReference })).toBe("PAYMENT_REFERENCE");
  });

  it("sends the exchange when every step is complete", () => {
    expect(exchangeBlockerOf(ready)).toBeUndefined();
  });
});

describe("exchange offer and approvals", () => {
  it("offers an exchange only for an order with a customer", () => {
    const completed = ORDER_STATUS.COMPLETED;
    expect(canOfferExchange(orderWith({ contactId: "contact-1", status: completed }), true)).toBe(
      true,
    );
    expect(canOfferExchange(orderWith({ contactId: null, status: completed }), true)).toBe(false);
  });

  it("asks the discount PIN only when the quote of the new lines asks for it", () => {
    const withDiscount = {
      lines: [{ manualDiscount: money(300) }],
      approvalsRequired: [{ action: APPROVAL_ACTION.DISCOUNT }],
    } as unknown as QuoteResponse;
    const withoutDiscount = { lines: [], approvalsRequired: [] } as unknown as QuoteResponse;
    expect(discountApprovalOf(withDiscount, CURRENCY)).toEqual(money(300));
    expect(discountApprovalOf(withoutDiscount, CURRENCY)).toBeUndefined();
  });

  it("asks the return PINs first and the new order's discount PIN last", () => {
    const preview = previewOf({ total: 2500, creditUsed: 2500 });
    const steps = exchangeApprovalStepsOf(
      { ...preview, salesReturn: { ...preview.salesReturn, requiresRefundApproval: true } },
      { orderId: ORDER_ID, locationId: "location-1" },
      money(300),
    );
    expect(steps.map((step) => step.key)).toEqual(["refund", EXCHANGE_DISCOUNT_APPROVAL_KEY]);
    expect(steps[1]?.subjectKey).toBe(INSTANT_ORDER_APPROVAL_SUBJECT);
  });
});
