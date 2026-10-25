import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import {
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesReturnPreviewResponse,
} from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import {
  RETURN_APPROVAL_KEY,
  approvalTokensOf,
  buildReturnBody,
  canOfferReturn,
  isWithinReturnWindow,
  needsRefundReference,
  pickedReturnLines,
  refundMethodsFor,
  returnApprovalStepsOf,
  returnDraftsOf,
  withReturnQuantity,
  withReturnDisposition,
  reasonNeedsNote,
} from "./return-model";

const ORDER_ID = "01900000-0000-7000-8000-000000000010";
const LINE_ID = "01900000-0000-7000-8000-000000000020";
const OTHER_LINE_ID = "01900000-0000-7000-8000-000000000021";
const LOCATION_ID = "01900000-0000-7000-8000-000000000030";
const TIMESTAMP = "2026-10-24T00:00:00.000Z";

function lineOf(orderLineId: string, quantity: number, returnedQuantity: number) {
  return {
    orderLineId,
    offeringId: "offering-1",
    variantId: "variant-1",
    kind: "PRODUCT",
    nameSnapshot: "Rice 5 kg",
    quantity,
    unitPrice: { amount: 1000, currency: "BDT" },
    listUnitPrice: { amount: 1000, currency: "BDT" },
    unitPriceOverride: null,
    lineGross: { amount: 1000 * quantity, currency: "BDT" },
    lineDiscount: { amount: 0, currency: "BDT" },
    lineTax: { amount: 0, currency: "BDT" },
    lineNetTotal: { amount: 1000 * quantity, currency: "BDT" },
    unitCostSnapshot: null,
    modifiers: [],
    returnedQuantity,
    promotionIds: [],
    taxClassKey: null,
    manualDiscount: null,
    performedByMemberId: null,
  } as const;
}

function orderWith(
  status: (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS],
  lines: ReturnType<typeof lineOf>[],
  returnStatus: (typeof ORDER_RETURN_STATUS)[keyof typeof ORDER_RETURN_STATUS] = ORDER_RETURN_STATUS.NONE,
): OrderResponse {
  return {
    orderId: ORDER_ID,
    orderNumber: "000001",
    invoiceNumber: "INV-1",
    locationId: LOCATION_ID,
    contactId: "contact-1",
    status,
    lines,
    totals: {
      subtotal: { amount: 3000, currency: "BDT" },
      discountTotal: { amount: 0, currency: "BDT" },
      taxTotal: { amount: 0, currency: "BDT" },
      deliveryCharge: { amount: 0, currency: "BDT" },
      grandTotal: { amount: 3000, currency: "BDT" },
      roundingAdjustment: { amount: 0, currency: "BDT" },
    },
    fulfillment: { method: "PICKUP" },
    paymentStatus: "PAID",
    returnStatus,
    businessDate: "2026-10-24",
    source: "ADMIN",
    approval: null,
    note: null,
    orderDiscount: null,
    customFields: {},
    version: 3,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  } as OrderResponse;
}

function previewWith(overrides: Partial<SalesReturnPreviewResponse>): SalesReturnPreviewResponse {
  const money = { amount: 0, currency: "BDT" as const };
  return {
    lines: [],
    deliveryChargeReturned: money,
    roundingReturned: money,
    value: money,
    dueReduced: money,
    refundAmount: money,
    requiresRefundApproval: false,
    requiresNotReceivedApproval: false,
    ...overrides,
  };
}

describe("return sheet quantities", () => {
  const order = orderWith(ORDER_STATUS.COMPLETED, [lineOf(LINE_ID, 3, 2)]);

  it("offers only what is left on the line, not what was sold", () => {
    const [draft] = returnDraftsOf(order);
    expect(draft?.remainingQuantity).toBe(1);
    expect(draft?.quantity).toBe(0);
  });

  it("never lets the stepper go above what is left or below zero", () => {
    const high = withReturnQuantity(returnDraftsOf(order), LINE_ID, 5);
    const low = withReturnQuantity(high, LINE_ID, -2);
    expect(high[0]?.quantity).toBe(1);
    expect(low[0]?.quantity).toBe(0);
  });

  it("ignores a fractional quantity and keeps the last valid one", () => {
    const picked = withReturnQuantity(returnDraftsOf(order), LINE_ID, 1);
    const fractional = withReturnQuantity(picked, LINE_ID, 0.5);
    expect(fractional[0]?.quantity).toBe(1);
  });

  it("changes only the disposition of the chosen line", () => {
    const orderWithTwo = orderWith(ORDER_STATUS.COMPLETED, [
      lineOf(LINE_ID, 2, 0),
      lineOf(OTHER_LINE_ID, 2, 0),
    ]);
    const changed = withReturnDisposition(
      returnDraftsOf(orderWithTwo),
      LINE_ID,
      RETURN_DISPOSITION.DAMAGED,
    );
    expect(changed.map((draft) => draft.disposition)).toEqual([
      RETURN_DISPOSITION.DAMAGED,
      RETURN_DISPOSITION.RESTOCK,
    ]);
  });
});

describe("return request body", () => {
  it("sends only the lines that were picked, with their quantity and disposition", () => {
    const order = orderWith(ORDER_STATUS.COMPLETED, [
      lineOf(LINE_ID, 3, 0),
      lineOf(OTHER_LINE_ID, 2, 0),
    ]);
    const picked = withReturnQuantity(returnDraftsOf(order), LINE_ID, 1);
    const body = buildReturnBody({
      drafts: picked,
      returnDeliveryCharge: false,
      refundMethod: null,
      refundExternalReference: "",
      reasonKey: SALES_RETURN_REASON.DEFECTIVE,
      note: "",
    });
    expect(body.lines).toEqual([
      { orderLineId: LINE_ID, quantity: 1, disposition: RETURN_DISPOSITION.RESTOCK },
    ]);
  });

  it("leaves out an empty note, an empty reference and a missing refund method", () => {
    const picked = withReturnQuantity(
      returnDraftsOf(orderWith(ORDER_STATUS.COMPLETED, [lineOf(LINE_ID, 1, 0)])),
      LINE_ID,
      1,
    );
    const body = buildReturnBody({
      drafts: picked,
      returnDeliveryCharge: true,
      refundMethod: null,
      refundExternalReference: "  ",
      reasonKey: SALES_RETURN_REASON.CHANGED_MIND,
      note: "   ",
    });
    expect(body).not.toHaveProperty("note");
    expect(body).not.toHaveProperty("refundMethod");
    expect(body).not.toHaveProperty("refundExternalReference");
    expect(body.returnDeliveryCharge).toBe(true);
  });

  it("sends the mobile money reference only for bKash and Nagad refunds", () => {
    expect(needsRefundReference(PAYMENT_METHOD.BKASH)).toBe(true);
    expect(needsRefundReference(PAYMENT_METHOD.NAGAD)).toBe(true);
    expect(needsRefundReference(PAYMENT_METHOD.CASH)).toBe(false);
    expect(needsRefundReference(null)).toBe(false);
  });

  it("names the picked lines only once the sheet has one", () => {
    const drafts = returnDraftsOf(orderWith(ORDER_STATUS.COMPLETED, [lineOf(LINE_ID, 1, 0)]));
    expect(pickedReturnLines(drafts)).toHaveLength(0);
  });
});

describe("return approvals", () => {
  const order = orderWith(ORDER_STATUS.COMPLETED, [lineOf(LINE_ID, 2, 0)]);

  it("asks for no PIN when the preview needs no approval", () => {
    expect(returnApprovalStepsOf(previewWith({}), order)).toEqual([]);
  });

  it("asks for the refund PIN first, then the not-received PIN with the not-received value", () => {
    const preview = previewWith({
      requiresRefundApproval: true,
      requiresNotReceivedApproval: true,
      refundAmount: { amount: 2000, currency: "BDT" },
      lines: [
        {
          orderLineId: LINE_ID,
          nameSnapshot: "Rice 5 kg",
          quantity: 2,
          disposition: RETURN_DISPOSITION.NOT_RECEIVED,
          value: { amount: 2000, currency: "BDT" },
          taxPart: { amount: 0, currency: "BDT" },
        },
      ],
    });
    const steps = returnApprovalStepsOf(preview, order);
    expect(steps.map((step) => step.key)).toEqual([
      RETURN_APPROVAL_KEY.REFUND,
      RETURN_APPROVAL_KEY.RETURN_NOT_RECEIVED,
    ]);
    expect(steps[0]?.action).toBe(APPROVAL_ACTION.REFUND);
    expect(steps[0]?.amount).toEqual({ amount: 2000, currency: "BDT" });
    expect(steps[1]?.amount).toEqual({ amount: 2000, currency: "BDT" });
    expect(steps[0]?.subjectKey).toBe(`order:${ORDER_ID}`);
  });

  it("sends only the token keys that were granted", () => {
    expect(approvalTokensOf({ refund: "token-a" })).toEqual({ refund: "token-a" });
    expect(approvalTokensOf({})).toEqual({});
  });
});

describe("return window and eligibility", () => {
  it("keeps the last day of the window open and closes the day after", () => {
    expect(isWithinReturnWindow("2026-10-24", 7, "2026-10-31")).toBe(true);
    expect(isWithinReturnWindow("2026-10-24", 7, "2026-11-01")).toBe(false);
  });

  it("closes the window the same day when the window is zero days", () => {
    expect(isWithinReturnWindow("2026-10-24", 0, "2026-10-24")).toBe(true);
    expect(isWithinReturnWindow("2026-10-24", 0, "2026-10-25")).toBe(false);
  });

  it("offers a return only for a completed order that still has goods to return, inside the window", () => {
    const partial = orderWith(
      ORDER_STATUS.COMPLETED,
      [lineOf(LINE_ID, 2, 1)],
      ORDER_RETURN_STATUS.PARTIAL,
    );
    const full = orderWith(
      ORDER_STATUS.COMPLETED,
      [lineOf(LINE_ID, 2, 2)],
      ORDER_RETURN_STATUS.FULL,
    );
    const placed = orderWith(ORDER_STATUS.PLACED, [lineOf(LINE_ID, 2, 0)]);
    expect(canOfferReturn(partial, true)).toBe(true);
    expect(canOfferReturn(partial, false)).toBe(false);
    expect(canOfferReturn(full, true)).toBe(false);
    expect(canOfferReturn(placed, true)).toBe(false);
  });

  it("refuses the store credit method without a contact and never offers GATEWAY", () => {
    const methods = [PAYMENT_METHOD.CASH, PAYMENT_METHOD.STORE_CREDIT, PAYMENT_METHOD.GATEWAY];
    expect(refundMethodsFor(methods, false)).toEqual([PAYMENT_METHOD.CASH]);
    expect(refundMethodsFor(methods, true)).toEqual([
      PAYMENT_METHOD.CASH,
      PAYMENT_METHOD.STORE_CREDIT,
    ]);
  });

  it("requires a note only when the reason is Other", () => {
    expect(reasonNeedsNote(SALES_RETURN_REASON.OTHER, "  ")).toBe(true);
    expect(reasonNeedsNote(SALES_RETURN_REASON.OTHER, "damaged box")).toBe(false);
    expect(reasonNeedsNote(SALES_RETURN_REASON.DEFECTIVE, "")).toBe(false);
  });
});
