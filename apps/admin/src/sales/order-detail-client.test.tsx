// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { SALES_RULE_KEY, type OrderResponse, type OrderStatus } from "@banijjik/contracts/sales";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { paymentLabelsOf } from "../payments/payment-labels";
import { OrderDetailClient } from "./order-detail-client";
import { orderLabelsOf } from "./order-labels";

const { refresh, push } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

const placeOrderMock = vi.fn();
const confirmOrderMock = vi.fn();
const packOrderMock = vi.fn();
const completeOrderMock = vi.fn();
const cancelOrderMock = vi.fn();
const deleteDraftMock = vi.fn();
const quoteOrderMock = vi.fn();
vi.mock("./order-api", () => ({
  placeOrder: (...args: unknown[]) => placeOrderMock(...args),
  confirmOrder: (...args: unknown[]) => confirmOrderMock(...args),
  packOrder: (...args: unknown[]) => packOrderMock(...args),
  completeOrder: (...args: unknown[]) => completeOrderMock(...args),
  cancelOrder: (...args: unknown[]) => cancelOrderMock(...args),
  deleteDraft: (...args: unknown[]) => deleteDraftMock(...args),
  quoteOrder: (...args: unknown[]) => quoteOrderMock(...args),
}));

const paySheetMock = vi.fn();
vi.mock("../payments/receive-payment-sheet-lazy", () => ({
  ReceivePaymentSheetLazy: (props: { open: boolean }) => {
    paySheetMock(props);
    return props.open ? <div data-testid="pay-sheet" /> : null;
  },
}));

vi.mock("./lazy-order-edit-sheet", () => ({
  LazyOrderEditSheet: () => null,
}));

const labels = orderLabelsOf(banglaTranslator().t);
const paymentLabels = paymentLabelsOf(banglaTranslator().t);
const ORDER_ID = "01900000-0000-7000-8000-000000000010";
const TIMESTAMP = "2026-10-24T00:00:00.000Z";

function orderWith(status: OrderStatus): OrderResponse {
  return {
    orderId: ORDER_ID,
    orderNumber: status === "DRAFT" ? null : "000001",
    invoiceNumber: null,
    locationId: "location-1",
    contactId: "contact-1",
    contactName: "রহিম উদ্দিন",
    status,
    lines: [],
    totals: {
      subtotal: { amount: 50000, currency: "BDT" },
      discountTotal: { amount: 0, currency: "BDT" },
      taxTotal: { amount: 0, currency: "BDT" },
      deliveryCharge: { amount: 0, currency: "BDT" },
      grandTotal: { amount: 50000, currency: "BDT" },
      roundingAdjustment: { amount: 0, currency: "BDT" },
    },
    fulfillment: { method: "PICKUP" },
    paymentStatus: "UNPAID",
    businessDate: "2026-10-24",
    source: "ADMIN",
    approval: null,
    note: null,
    orderDiscount: null,
    customFields: {},
    version: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function renderClient(
  status: OrderStatus,
  overrides: {
    readonly usePacking?: boolean;
    readonly remainingDueMinor?: number;
    readonly permissions?: Partial<{
      canUpdate: boolean;
      canConfirm: boolean;
      canCancel: boolean;
      canReceive: boolean;
    }>;
  } = {},
): void {
  renderInBangla(
    <OrderDetailClient
      orgSlug="acme"
      organizationId="org-1"
      order={orderWith(status)}
      locationName="ধানমন্ডি শাখা"
      contactName="রহিম উদ্দিন"
      remainingDueMinor={overrides.remainingDueMinor ?? 0}
      hasNetPaid={false}
      currency="BDT"
      currencySymbol="৳"
      allowedMethods={[]}
      permissions={{
        canUpdate: true,
        canConfirm: true,
        canCancel: true,
        canReceive: true,
        ...overrides.permissions,
      }}
      usePacking={overrides.usePacking ?? false}
      modifierGroups={[]}
      unitLabels={{}}
      locale="bn"
      labels={labels}
      paymentLabels={paymentLabels}
    />,
  );
}

function buttonNamed(name: string): HTMLElement | null {
  return screen.queryByRole("button", { name });
}

function cancelReasonField(): HTMLTextAreaElement {
  const field = document.querySelector<HTMLTextAreaElement>("#order-cancel-reason");
  if (field === null) throw new Error("the cancel reason field is missing");
  return field;
}

function ruleFailure(ruleKey: string): ApiError {
  return new ApiError({
    status: 422,
    code: ERROR_CODE.VALIDATION_ERROR,
    messageKey: "errors.internal",
    details: { ruleKey },
  });
}

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  placeOrderMock.mockReset();
  confirmOrderMock.mockReset();
  packOrderMock.mockReset();
  completeOrderMock.mockReset();
  cancelOrderMock.mockReset();
  deleteDraftMock.mockReset();
  quoteOrderMock.mockReset();
  paySheetMock.mockReset();
});

afterEach(cleanup);

describe("OrderDetailClient status actions", () => {
  it("offers edit, place, cancel and delete for a draft", () => {
    renderClient("DRAFT");

    expect(buttonNamed(labels.actions.edit)).not.toBeNull();
    expect(buttonNamed(labels.actions.place)).not.toBeNull();
    expect(buttonNamed(labels.actions.cancel)).not.toBeNull();
    expect(buttonNamed(labels.actions.deleteDraft)).not.toBeNull();
    expect(buttonNamed(labels.actions.confirm)).toBeNull();
    expect(buttonNamed(labels.actions.complete)).toBeNull();
  });

  it("offers confirm only for a placed order and only to a caller allowed to confirm", () => {
    renderClient("PLACED");
    expect(buttonNamed(labels.actions.confirm)).not.toBeNull();
    expect(buttonNamed(labels.actions.place)).toBeNull();
  });

  it("hides confirm when the caller may not confirm", () => {
    renderClient("PLACED", { permissions: { canConfirm: false } });
    expect(buttonNamed(labels.actions.confirm)).toBeNull();
  });

  it("offers pack only when packing is on, and completes a confirmed order", () => {
    renderClient("CONFIRMED", { usePacking: true });
    expect(buttonNamed(labels.actions.pack)).not.toBeNull();
    expect(buttonNamed(labels.actions.complete)).not.toBeNull();
  });

  it("hides pack when packing is off", () => {
    renderClient("CONFIRMED", { usePacking: false });
    expect(buttonNamed(labels.actions.pack)).toBeNull();
    expect(buttonNamed(labels.actions.complete)).not.toBeNull();
  });

  it("offers no actions once the order is completed", () => {
    renderClient("COMPLETED");

    expect(screen.queryByText(labels.detail.actionsTitle)).toBeNull();
    expect(screen.getByText(labels.paymentStatus.UNPAID)).toBeDefined();
  });

  it("places a draft at its version and refreshes", async () => {
    const user = userEvent.setup();
    renderClient("DRAFT");
    placeOrderMock.mockResolvedValue(orderWith("PLACED"));

    await user.click(screen.getByRole("button", { name: labels.actions.place }));

    await waitFor(() => {
      expect(placeOrderMock).toHaveBeenCalledWith("org-1", ORDER_ID, { version: 1 });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("answers an advance refusal with its message and a way to receive payment", async () => {
    const user = userEvent.setup();
    renderClient("PLACED", { remainingDueMinor: 50000 });
    confirmOrderMock.mockRejectedValue(ruleFailure(SALES_RULE_KEY.ADVANCE_NEEDS_PAYMENTS));

    await user.click(screen.getByRole("button", { name: labels.actions.confirm }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(banglaTranslator().t("errors.internal"));
    expect(screen.getAllByRole("button", { name: labels.detail.receivePayment })).toHaveLength(2);
  });

  it("opens the receive sheet from the order with its remaining due", async () => {
    const user = userEvent.setup();
    renderClient("PLACED", { remainingDueMinor: 50000 });

    await user.click(screen.getByRole("button", { name: labels.detail.receivePayment }));

    expect(paySheetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        initialDueMinor: 50000,
        initialAllocations: [
          expect.objectContaining({
            requestType: "ORDER",
            requestId: ORDER_ID,
            amount: { amount: 50000, currency: "BDT" },
          }),
        ],
      }),
    );
  });

  it("insists on a reason before cancelling", async () => {
    const user = userEvent.setup();
    renderClient("PLACED");

    await user.click(screen.getByRole("button", { name: labels.actions.cancel }));
    await user.click(screen.getByRole("button", { name: labels.cancelDialog.submit }));

    expect(screen.getByText(labels.cancelDialog.reasonRequired)).toBeDefined();
    expect(cancelOrderMock).not.toHaveBeenCalled();
  });

  it("cancels with the reason and refreshes", async () => {
    const user = userEvent.setup();
    renderClient("PLACED");
    cancelOrderMock.mockResolvedValue(orderWith("CANCELLED"));

    await user.click(screen.getByRole("button", { name: labels.actions.cancel }));
    await user.type(cancelReasonField(), "গ্রাহক বাতিল করেছেন");
    await user.click(screen.getByRole("button", { name: labels.cancelDialog.submit }));

    await waitFor(() => {
      expect(cancelOrderMock).toHaveBeenCalledWith("org-1", ORDER_ID, {
        version: 1,
        reason: "গ্রাহক বাতিল করেছেন",
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the pick-contact way out when cancelling needs a contact", async () => {
    const user = userEvent.setup();
    renderClient("PLACED");
    cancelOrderMock.mockRejectedValue(ruleFailure(SALES_RULE_KEY.ORDER_CANCEL_NEEDS_CONTACT));

    await user.click(screen.getByRole("button", { name: labels.actions.cancel }));
    await user.type(cancelReasonField(), "ভুল অর্ডার");
    await user.click(screen.getByRole("button", { name: labels.cancelDialog.submit }));

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: labels.cancelDialog.pickContact }).length,
      ).toBeGreaterThan(0);
    });
  });

  it("deletes a draft through the confirmation and returns to the list", async () => {
    const user = userEvent.setup();
    renderClient("DRAFT");
    deleteDraftMock.mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: labels.actions.deleteDraft }));
    const confirmButtons = screen.getAllByRole("button", { name: labels.actions.deleteDraft });
    await user.click(confirmButtons[confirmButtons.length - 1] as HTMLElement);

    await waitFor(() => {
      expect(deleteDraftMock).toHaveBeenCalledWith("org-1", ORDER_ID, 1);
      expect(push).toHaveBeenCalledWith("/acme/orders");
    });
  });
});
