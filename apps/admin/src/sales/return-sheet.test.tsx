// @vitest-environment jsdom
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import {
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  type OrderResponse,
  type SalesReturnPreviewResponse,
} from "@banijjik/contracts/sales";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { orderLabelsOf } from "./order-labels";
import { returnLabelsOf } from "./return-labels";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

const previewReturnMock = vi.fn();
const createReturnMock = vi.fn();
vi.mock("./return-api", () => ({
  previewReturn: (...args: unknown[]) => previewReturnMock(...args),
  createReturn: (...args: unknown[]) => createReturnMock(...args),
  newSubmitKey: () => "submit-key-1",
}));

vi.mock("./lazy-order-approval-dialog", () => ({
  LazyOrderApprovalDialog: () => null,
}));

vi.mock("./order-toast", () => ({ showSuccessToast: vi.fn() }));

import { ReturnSheet } from "./return-sheet";

const ORDER_ID = "01900000-0000-7000-8000-000000000010";
const LINE_ID = "01900000-0000-7000-8000-000000000020";
const TIMESTAMP = "2026-10-24T00:00:00.000Z";
const BDT = { amount: 0, currency: "BDT" as const };

const labels = returnLabelsOf(banglaTranslator().t);
const approvalLabels = orderLabelsOf(banglaTranslator().t).approval;

function orderWithOneLine(soldQuantity: number, returnedQuantity: number): OrderResponse {
  return {
    orderId: ORDER_ID,
    orderNumber: "000001",
    invoiceNumber: "INV-1",
    locationId: "location-1",
    contactId: "contact-1",
    status: ORDER_STATUS.COMPLETED,
    lines: [
      {
        orderLineId: LINE_ID,
        offeringId: "offering-1",
        variantId: "variant-1",
        kind: "PRODUCT",
        nameSnapshot: "Rice 5 kg",
        quantity: soldQuantity,
        unitPrice: { amount: 1000, currency: "BDT" },
        listUnitPrice: { amount: 1000, currency: "BDT" },
        unitPriceOverride: null,
        lineGross: { amount: 1000 * soldQuantity, currency: "BDT" },
        lineDiscount: BDT,
        lineTax: BDT,
        lineNetTotal: { amount: 1000 * soldQuantity, currency: "BDT" },
        unitCostSnapshot: null,
        modifiers: [],
        returnedQuantity,
        promotionIds: [],
        taxClassKey: null,
        manualDiscount: null,
        performedByMemberId: null,
      },
    ],
    totals: {
      subtotal: { amount: 1000 * soldQuantity, currency: "BDT" },
      discountTotal: BDT,
      taxTotal: BDT,
      deliveryCharge: BDT,
      grandTotal: { amount: 1000 * soldQuantity, currency: "BDT" },
      roundingAdjustment: BDT,
    },
    fulfillment: { method: "PICKUP" },
    paymentStatus: "PAID",
    returnStatus: ORDER_RETURN_STATUS.PARTIAL,
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

function previewWithRefund(refundMinor: number): SalesReturnPreviewResponse {
  const refund = { amount: refundMinor, currency: "BDT" as const };
  return {
    lines: [],
    deliveryChargeReturned: BDT,
    roundingReturned: BDT,
    value: { amount: 1000, currency: "BDT" },
    dueReduced: { amount: 0, currency: "BDT" },
    refundAmount: refund,
    requiresRefundApproval: refundMinor > 0,
    requiresNotReceivedApproval: false,
  };
}

function renderSheet(order: OrderResponse): void {
  renderInBangla(
    <ReturnSheet
      open
      onOpenChange={() => undefined}
      orgSlug="acme"
      organizationId="org-1"
      order={order}
      allowedMethods={[PAYMENT_METHOD.CASH, PAYMENT_METHOD.STORE_CREDIT]}
      methodLabels={{ CASH: "নগদ", STORE_CREDIT: "স্টোর ক্রেডিট" }}
      locale="bn"
      labels={labels}
      approvalLabels={approvalLabels}
    />,
  );
}

describe("return sheet", () => {
  beforeEach(() => {
    previewReturnMock.mockReset();
    createReturnMock.mockReset();
    previewReturnMock.mockResolvedValue(previewWithRefund(0));
  });

  afterEach(() => {
    cleanup();
  });

  it("caps the stepper at what is left on the line", async () => {
    renderSheet(orderWithOneLine(3, 2));
    const more = screen.getByRole("button", { name: labels.sheet.increase });
    await userEvent.click(more);
    expect(screen.getByText("1", { selector: "span" })).toBeTruthy();
    expect(more).toHaveProperty("disabled", true);
  });

  it("shows the server preview of the picked lines before a submit", async () => {
    renderSheet(orderWithOneLine(3, 0));
    await userEvent.click(screen.getByRole("button", { name: labels.sheet.increase }));
    await screen.findByText(labels.sheet.previewValue);
    expect(previewReturnMock).toHaveBeenCalledWith(
      "org-1",
      ORDER_ID,
      expect.objectContaining({
        lines: [expect.objectContaining({ orderLineId: LINE_ID, quantity: 1 })],
      }),
    );
  });

  it("asks for a refund method only when a refund is due", async () => {
    previewReturnMock.mockResolvedValue(previewWithRefund(0));
    renderSheet(orderWithOneLine(3, 0));
    await userEvent.click(screen.getByRole("button", { name: labels.sheet.increase }));
    await screen.findByText(labels.sheet.noRefund);
    expect(screen.queryByLabelText(new RegExp(labels.sheet.refundMethod))).toBeNull();
  });

  it("offers the refund method once the preview says money goes back", async () => {
    previewReturnMock.mockResolvedValue(previewWithRefund(1000));
    renderSheet(orderWithOneLine(3, 0));
    await userEvent.click(screen.getByRole("button", { name: labels.sheet.increase }));
    await waitFor(() =>
      expect(screen.getByLabelText(new RegExp(labels.sheet.refundMethod))).toBeTruthy(),
    );
  });

  it("keeps the submit closed until a reason is chosen", async () => {
    renderSheet(orderWithOneLine(3, 0));
    await userEvent.click(screen.getByRole("button", { name: labels.sheet.increase }));
    await screen.findByText(labels.sheet.previewValue);
    expect(screen.getByRole("button", { name: labels.sheet.submit })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
