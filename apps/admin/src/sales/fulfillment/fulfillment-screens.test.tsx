// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { DeliveryAttempt } from "@banijjik/contracts/sales/delivery";
import { DeliveryAttemptsCard } from "./delivery-attempts-card";
import { OrderShipSheet } from "./order-ship-sheet";
import { DeliveryAttemptSheet } from "./delivery-attempt-sheet";
import { OrderRtsSheet } from "./order-rts-sheet";
import { DeliveryLossSheet } from "./delivery-loss-sheet";
import * as fulfillmentApi from "./fulfillment-api";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock order-toast
vi.mock("../order-toast", () => ({
  showSuccessToast: vi.fn(),
}));

const mockOrder: OrderResponse = {
  orderId: "order-123",
  orderNumber: "ORD-001",
  invoiceNumber: null,
  locationId: "loc-1",
  contactId: null,
  contactName: null,
  status: "CONFIRMED",
  source: "STOREFRONT",
  fulfillment: { method: "COURIER" },
  totals: {
    subtotal: { amount: 10000, currency: "BDT" },
    discountTotal: { amount: 0, currency: "BDT" },
    taxTotal: { amount: 0, currency: "BDT" },
    deliveryCharge: { amount: 60, currency: "BDT" },
    roundingAdjustment: { amount: 0, currency: "BDT" },
    grandTotal: { amount: 10060, currency: "BDT" },
  },
  lines: [
    {
      orderLineId: "line-1",
      offeringId: "off-1",
      variantId: "var-1",
      kind: "PRODUCT",
      nameSnapshot: "Shirt",
      quantity: 2,
      unitPrice: { amount: 5000, currency: "BDT" },
      listUnitPrice: { amount: 5000, currency: "BDT" },
      unitPriceOverride: null,
      lineGross: { amount: 10000, currency: "BDT" },
      lineDiscount: { amount: 0, currency: "BDT" },
      lineTax: { amount: 0, currency: "BDT" },
      lineNetTotal: { amount: 10000, currency: "BDT" },
      unitCostSnapshot: null,
      modifiers: [],
      returnedQuantity: 0,
      promotionIds: [],
      taxClassKey: null,
      manualDiscount: null,
      performedByMemberId: null,
    },
  ],
  version: 1,
  paymentStatus: "UNPAID",
  returnStatus: "NONE",
  businessDate: "2026-11-07",
  approval: null,
  note: null,
  orderDiscount: null,
  customFields: {},
  delivery: {
    address: null,
    deliveryZoneId: null,
    shippedAt: null,
    deliveredAt: null,
    currentDeliveryAttemptId: null,
    deliveryAttemptCount: 0,
    firstShipment: null,
  },
  createdAt: "2026-11-07T00:00:00.000Z",
  updatedAt: "2026-11-07T00:00:00.000Z",
};

const mockLabels = {
  ship: {
    title: "Ship order",
    reshipTitle: "Reship order",
    method: "Fulfillment method",
    courier: "Courier",
    rider: "Own rider",
    consignmentId: "Consignment ID",
    consignmentPlaceholder: "Enter consignment ID",
    assignmentId: "Delivery assignment ID",
    assignmentPlaceholder: "Enter delivery assignment ID",
    submit: "Confirm shipment",
    reshipSubmit: "Confirm reshipment",
    success: "Order shipped successfully.",
    reshipSuccess: "Order reshipped successfully.",
  },
  attempt: {
    title: "Record failed delivery attempt",
    reason: "Failure reason",
    reasonPlaceholder: "Select a reason",
    reasons: {
      customerUnreachable: "Customer unreachable",
      incorrectAddress: "Incorrect address",
      customerRescheduled: "Customer requested reschedule",
      cashNotReady: "Cash not ready",
      other: "Other reason",
    },
    note: "Note",
    notePlaceholder: "Optional notes about the delivery attempt",
    submit: "Record failure",
    success: "Delivery attempt failure recorded.",
  },
  rts: {
    title: "Receive return to sender (RTS)",
    description: "Mark order items as returned to sender and restore inventory.",
    reason: "Return reason",
    disposition: "Disposition",
    restock: "Restock to available",
    damaged: "Mark as damaged",
    submit: "Receive RTS",
    success: "Return to sender received successfully.",
  },
  loss: {
    closeTitle: "Reconcile delivery loss",
    closeDescription: "Reconcile missing or lost items with manager approval.",
    recoverTitle: "Recover lost items",
    recoverDescription: "Record physical recovery of previously lost units.",
    lost: "Lost",
    restock: "Restock",
    damaged: "Damaged",
    submitClose: "Close delivery loss",
    submitRecover: "Record recovery",
    successClose: "Delivery loss reconciled successfully.",
    successRecover: "Lost items recovered successfully.",
  },
  attempts: {
    title: "Delivery attempts",
    empty: "No delivery attempts yet.",
    ordinal: "Attempt",
    started: "Dispatched at",
    failed: "Failed at",
    method: "Method",
  },
  actions: {
    close: "Close",
    ship: "Ship order",
    failAttempt: "Record failed delivery",
    reship: "Reship order",
    rts: "Receive return (RTS)",
    reconcileLoss: "Reconcile loss",
    recoverLoss: "Recover lost items",
    edit: "Edit",
    place: "Place",
    confirm: "Confirm",
    pack: "Pack",
    complete: "Complete",
    cancel: "Cancel",
    deleteDraft: "Delete",
    receivePayment: "Pay",
    save: "Save",
  },
  approval: {
    title: "Approval PIN",
    approver: "Approver",
    pin: "Enter PIN",
    submit: "Submit",
    cancel: "Cancel",
    close: "Close",
    locked: "Locked",
    failed: "Failed",
    loadFailed: "Load failed",
    noApprovers: "No approvers",
  },
} as any;

describe("DeliveryAttemptsCard", () => {
  it("renders null when attempts list is empty", () => {
    const { container } = render(<DeliveryAttemptsCard attempts={[]} labels={mockLabels} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders attempts with ordinal and method", () => {
    const attempts: DeliveryAttempt[] = [
      {
        deliveryAttemptId: "att-1",
        organizationId: "org-1",
        orderId: "order-123",
        ordinal: 1,
        method: "COURIER",
        consignmentId: "CS-999",
        deliveryAssignmentId: null,
        startedAt: new Date("2026-11-07T10:00:00Z"),
        failedAt: new Date("2026-11-07T14:00:00Z"),
        reasonKey: "RECIPIENT_UNAVAILABLE",
        note: "Phone was switched off",
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
      },
    ];

    render(<DeliveryAttemptsCard attempts={attempts} labels={mockLabels} />);
    expect(screen.getByText(/Attempt #1/)).toBeDefined();
    expect(screen.getByText(/CS-999/)).toBeDefined();
    expect(screen.getByText(/RECIPIENT_UNAVAILABLE/)).toBeDefined();
    expect(screen.getByText(/Phone was switched off/)).toBeDefined();
  });
});

describe("OrderShipSheet", () => {
  it("validates consignment ID before calling shipOrder", async () => {
    const spy = vi.spyOn(fulfillmentApi, "shipOrder").mockResolvedValue(mockOrder);
    const onOpenChange = vi.fn();

    render(
      <OrderShipSheet
        open
        onOpenChange={onOpenChange}
        organizationId="org-1"
        order={mockOrder}
        labels={mockLabels}
      />,
    );

    const submitBtn = screen.getByText("Confirm shipment");
    fireEvent.click(submitBtn);

    expect(spy).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText("Enter consignment ID");
    fireEvent.change(input, { target: { value: "TRK-12345" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("org-1", "order-123", {
        version: 1,
        dispatch: { method: "COURIER", consignmentId: "TRK-12345" },
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("DeliveryAttemptSheet", () => {
  it("records failed delivery attempt with selected reason", async () => {
    const spy = vi.spyOn(fulfillmentApi, "recordDeliveryAttempt").mockResolvedValue(mockOrder);
    const onOpenChange = vi.fn();

    render(
      <DeliveryAttemptSheet
        open
        onOpenChange={onOpenChange}
        organizationId="org-1"
        order={mockOrder}
        labels={mockLabels}
      />,
    );

    const submitBtn = screen.getByText("Record failure");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("org-1", "order-123", {
        version: 1,
        reasonKey: "RECIPIENT_UNAVAILABLE",
        note: undefined,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("OrderRtsSheet", () => {
  it("submits receiveRts with selected disposition", async () => {
    const spy = vi.spyOn(fulfillmentApi, "receiveRts").mockResolvedValue(mockOrder);
    const onOpenChange = vi.fn();

    render(
      <OrderRtsSheet
        open
        onOpenChange={onOpenChange}
        organizationId="org-1"
        order={mockOrder}
        labels={mockLabels}
      />,
    );

    const submitBtn = screen.getByText("Receive RTS");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("org-1", "order-123", {
        version: 1,
        restockDisposition: "RESTOCK",
        note: undefined,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("DeliveryLossSheet", () => {
  it("submits reconcileDeliveryLoss with line quantities and approval token", async () => {
    const spy = vi.spyOn(fulfillmentApi, "reconcileDeliveryLoss").mockResolvedValue(mockOrder);
    const onOpenChange = vi.fn();

    render(
      <DeliveryLossSheet
        open
        onOpenChange={onOpenChange}
        organizationId="org-1"
        order={mockOrder}
        labels={mockLabels}
      />,
    );

    const submitBtn = screen.getByText("Close delivery loss");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("org-1", "order-123", {
        expectedVersion: 1,
        reasonKey: "GOODS_LOST_IN_TRANSIT",
        approvalToken: "approved",
        lines: [
          {
            orderLineId: "line-1",
            restockQuantity: 0,
            damagedQuantity: 0,
            lostQuantity: 2,
          },
        ],
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
