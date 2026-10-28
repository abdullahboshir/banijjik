import type { PosSaleResponse } from "@banijjik/contracts/pos";
import { describe, expect, it } from "vitest";
import { buildReceiptModel } from "./receipt-model";

const BDT = "BDT";

function sale(overrides: Partial<PosSaleResponse["order"]> = {}): PosSaleResponse {
  return {
    order: {
      orderId: "0190a000-0000-7000-8000-0000000000aa",
      orderNumber: "ORD-0007",
      invoiceNumber: "INV-0007",
      locationId: "0190a000-0000-7000-8000-000000000010",
      contactId: null,
      status: "COMPLETED",
      lines: [
        {
          nameSnapshot: "Milk tea (Large)",
          quantity: 2,
          lineNetTotal: { amount: 30_000, currency: BDT },
          performedByMemberId: null,
        },
      ],
      totals: {
        subtotal: { amount: 30_000, currency: BDT },
        discountTotal: { amount: 0, currency: BDT },
        taxTotal: { amount: 0, currency: BDT },
        deliveryCharge: { amount: 0, currency: BDT },
        grandTotal: { amount: 30_000, currency: BDT },
        roundingAdjustment: { amount: 0, currency: BDT },
      },
      businessDate: "2026-10-25",
      ...overrides,
    } as PosSaleResponse["order"],
    posSessionId: "0190a000-0000-7000-8000-0000000000bb",
    payments: [
      {
        paymentId: "p1",
        paymentNumber: "PAY-1",
        method: "CASH",
        amount: { amount: 30_000, currency: BDT },
      },
    ],
    storeCreditUsed: { amount: 0, currency: BDT },
    changeDue: { amount: 2_000, currency: BDT },
    dueAmount: { amount: 0, currency: BDT },
    receiptFooter: "Thank you",
  } as PosSaleResponse;
}

describe("receipt model", () => {
  it("shows the invoice number, the lines, the totals, the payments and the change from the server", () => {
    const model = buildReceiptModel(sale());

    expect(model.documentNumber).toBe("INV-0007");
    expect(model.businessDate).toBe("2026-10-25");
    expect(model.lines).toEqual([
      {
        name: "Milk tea (Large)",
        quantity: 2,
        lineNetTotal: { amount: 30_000, currency: BDT },
        performerName: null,
      },
    ]);
    expect(model.grandTotal).toEqual({ amount: 30_000, currency: BDT });
    expect(model.payments).toEqual([{ method: "CASH", amount: { amount: 30_000, currency: BDT } }]);
    expect(model.changeDue).toEqual({ amount: 2_000, currency: BDT });
    expect(model.footer).toBe("Thank you");
  });

  it("prints the performer name under a service line when the cashier named one", () => {
    const memberId = "0190a000-0000-7000-8000-0000000000a1";
    const base = sale();
    const first = base.order.lines[0];
    if (first === undefined) throw new Error("the fixture sale has no lines");
    const model = buildReceiptModel(
      {
        ...base,
        order: {
          ...base.order,
          lines: [{ ...first, nameSnapshot: "Haircut", performedByMemberId: memberId }],
        },
      },
      { [memberId]: "Mim" },
    );

    expect(model.lines[0]?.performerName).toBe("Mim");
  });

  it("falls back to the order number, then the order id, before an invoice number exists", () => {
    expect(buildReceiptModel(sale({ invoiceNumber: null })).documentNumber).toBe("ORD-0007");
    expect(buildReceiptModel(sale({ invoiceNumber: null, orderNumber: null })).documentNumber).toBe(
      "0190a000-0000-7000-8000-0000000000aa",
    );
  });
});
