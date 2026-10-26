// @vitest-environment jsdom
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import {
  ORDER_RETURN_STATUS,
  ORDER_STATUS,
  SALES_RETURN_REASON,
  type OrderResponse,
  type SalesExchangePaymentMethod,
  type SalesExchangePreviewResponse,
} from "@banijjik/contracts/sales";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { exchangeLabelsOf } from "./exchange-labels";
import type { ExchangePaymentDraft } from "./exchange-model";
import type { ExchangeFormActions } from "./use-exchange-sheet";
import { ExchangePaymentStep } from "./exchange-payment-step";
import { orderLabelsOf } from "./order-labels";
import { returnLabelsOf } from "./return-labels";

vi.mock("./exchange-api", () => ({
  previewExchange: vi.fn(() => new Promise(() => undefined)),
  createExchange: vi.fn(),
}));
vi.mock("./order-api", () => ({ quoteOrder: vi.fn() }));
vi.mock("./lazy-order-approval-dialog", () => ({ LazyOrderApprovalDialog: () => null }));

import { ExchangeSheet } from "./exchange-sheet";

const ORDER_ID = "01900000-0000-7000-8000-000000000010";
const LINE_ID = "01900000-0000-7000-8000-000000000020";
const TIMESTAMP = "2026-10-24T00:00:00.000Z";
const BDT = { amount: 0, currency: "BDT" as const };

const t = banglaTranslator().t;
const returnLabels = returnLabelsOf(t);
const orderLabels = orderLabelsOf(t);
const exchangeLabels = exchangeLabelsOf(t);

function completedOrder(): OrderResponse {
  return {
    orderId: ORDER_ID,
    orderNumber: "000002",
    invoiceNumber: "INV-2",
    locationId: "location-1",
    contactId: "contact-1",
    contactName: "করিম",
    status: ORDER_STATUS.COMPLETED,
    lines: [
      {
        orderLineId: LINE_ID,
        offeringId: "offering-1",
        variantId: "variant-1",
        kind: "PRODUCT",
        nameSnapshot: "Rice 5 kg",
        quantity: 2,
        unitPrice: { amount: 4000, currency: "BDT" },
        listUnitPrice: { amount: 4000, currency: "BDT" },
        unitPriceOverride: null,
        lineGross: { amount: 8000, currency: "BDT" },
        lineDiscount: BDT,
        lineTax: BDT,
        lineNetTotal: { amount: 8000, currency: "BDT" },
        unitCostSnapshot: null,
        modifiers: [],
        returnedQuantity: 0,
        promotionIds: [],
        taxClassKey: null,
        manualDiscount: null,
        performedByMemberId: null,
      },
    ],
    totals: {
      subtotal: { amount: 8000, currency: "BDT" },
      discountTotal: BDT,
      taxTotal: BDT,
      deliveryCharge: BDT,
      grandTotal: { amount: 8000, currency: "BDT" },
      roundingAdjustment: BDT,
    },
    fulfillment: { method: "PICKUP" },
    paymentStatus: "PAID",
    returnStatus: ORDER_RETURN_STATUS.NONE,
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

function renderSheet(): void {
  renderInBangla(
    <ExchangeSheet
      open
      onOpenChange={() => undefined}
      orgSlug="acme"
      organizationId="org-1"
      order={completedOrder()}
      allowedMethods={[PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH]}
      methodLabels={{ CASH: "নগদ", BKASH: "বিকাশ" }}
      locale="bn"
      currency="BDT"
      labels={returnLabels}
      orderLabels={orderLabels}
      modifierGroups={[]}
      unitLabels={{}}
      performersEnabled={false}
    />,
  );
}

function previewWithCredit(input: {
  readonly total: number;
  readonly creditUsed: number;
  readonly creditLeft: number;
}): SalesExchangePreviewResponse {
  const money = (amount: number) => ({ amount, currency: "BDT" as const });
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
    storeCreditLeft: money(input.creditLeft),
    dueAmount: money(0),
  };
}

/** The element with this id; a missing one fails the test at once with the selector in the message. */
function requiredElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`no element for ${selector}`);
  return element;
}

function paymentDraft(draftId: string, amountText: string): ExchangePaymentDraft {
  return { draftId, method: PAYMENT_METHOD.CASH, amountText, reference: "" };
}

describe("exchange sheet, the return step", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps the next step closed until a returned line and a reason are chosen", async () => {
    const user = userEvent.setup();
    renderSheet();
    const next = await screen.findByRole("button", { name: exchangeLabels.next });
    expect(next).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: returnLabels.sheet.increase }));
    expect(next).toHaveProperty("disabled", true);

    await user.selectOptions(
      requiredElement("#exchange-return-reason"),
      SALES_RETURN_REASON.CHANGED_MIND,
    );
    await waitFor(() => expect(next).toHaveProperty("disabled", false));
  });
});

type PaymentActions = Pick<ExchangeFormActions, "addPayment" | "changePayment" | "removePayment">;

function paymentActions(): PaymentActions {
  return {
    addPayment: vi.fn<(method: SalesExchangePaymentMethod) => void>(),
    changePayment: vi.fn<(draftId: string, changes: Partial<ExchangePaymentDraft>) => void>(),
    removePayment: vi.fn<(draftId: string) => void>(),
  };
}

describe("exchange payment step", () => {
  const readyPreview = previewWithCredit({ total: 4000, creditUsed: 2500, creditLeft: 1500 });

  function renderPaymentStep(
    payments: readonly ExchangePaymentDraft[],
    actions: PaymentActions,
  ): void {
    renderInBangla(
      <ExchangePaymentStep
        exchange={exchangeLabels}
        returnLabels={returnLabels}
        currency="BDT"
        locale="bn"
        methods={[PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH]}
        defaultMethod={PAYMENT_METHOD.CASH}
        methodLabels={{ CASH: "নগদ", BKASH: "বিকাশ" }}
        previewState={{ status: "ready", preview: readyPreview }}
        payments={payments}
        actions={actions}
      />,
    );
  }

  beforeEach(() => {
    cleanup();
  });

  it("shows the server numbers: the store credit used and left, and what is still due", () => {
    renderPaymentStep([], paymentActions());
    expect(screen.getByText(exchangeLabels.creditUsed)).toBeTruthy();
    expect(screen.getByText(exchangeLabels.creditLeft)).toBeTruthy();
    expect(screen.getByText(exchangeLabels.due)).toBeTruthy();
  });

  it("caps a payment line at what is left to pay after the credit and the other lines", () => {
    const actions = paymentActions();
    renderPaymentStep([paymentDraft("first", "10"), paymentDraft("second", "")], actions);
    // 40.00 total, 25.00 spent from the credit, 10.00 on the first line: 5.00 is left.
    fireEvent.change(requiredElement("#exchange-payment-1-amount"), {
      target: { value: "9999" },
    });
    expect(actions.changePayment).toHaveBeenCalledWith("second", { amountText: "5" });
  });
});
