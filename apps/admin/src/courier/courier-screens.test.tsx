// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ConsignmentResponse } from "@banijjik/contracts/courier";
import { CourierConsignmentsScreen } from "./courier-consignments-screen";
import { CourierSettlementSheet } from "./courier-settlement-sheet";
import { CourierSettlementReverseDialog } from "./courier-settlement-reverse-dialog";
import * as courierApi from "./courier-api";
import * as paymentApi from "../payments/payment-api";
import type { CourierLabels } from "./courier-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("./courier-toast", () => ({
  showSuccessToast: vi.fn(),
}));

const mockLabels: CourierLabels = {
  title: "Courier consignments",
  subtitle: "Track courier consignments and record COD settlements",
  empty: "No consignments found",
  courierKey: "Courier",
  trackingNumber: "Tracking number",
  orderId: "Order ID",
  location: "Location",
  status: "Status",
  created: "Created",
  filterCourierAll: "All couriers",
  recordSettlement: "Record settlement",
  reverseSettlement: "Reverse settlement",
  close: "Close",
  settlement: {
    title: "Record courier settlement",
    description: "Record collected COD cash received from the courier service",
    courier: "Courier service",
    reference: "Settlement reference",
    referencePlaceholder: "e.g. ST-SETTLE-001",
    charges: "Courier charge (BDT)",
    chargesPlaceholder: "0.00",
    receivedVia: "Received via",
    businessDate: "Business date",
    payments: "Payment IDs",
    paymentsPlaceholder: "Enter collection payment IDs",
    submit: "Record settlement",
    success: "Courier settlement recorded successfully",
  },
  reverse: {
    title: "Reverse courier settlement",
    description: "Reversing this settlement re-opens collection claims",
    reason: "Reversal reason",
    reasonPlaceholder: "Enter reason for reversal",
    submit: "Reverse settlement",
    success: "Courier settlement reversed",
  },
};

const mockConsignments: ConsignmentResponse[] = [
  {
    consignmentId: "c-1",
    organizationId: "org-1",
    locationId: "loc-1",
    orderId: "ord-1",
    attemptOrdinal: 1,
    courierKey: "STEADFAST",
    trackingNumber: "ST-12345",
    status: "BOOKED",
    version: 1,
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt: "2026-11-07T00:00:00.000Z",
  },
  {
    consignmentId: "c-2",
    organizationId: "org-1",
    locationId: "loc-1",
    orderId: "ord-2",
    attemptOrdinal: 1,
    courierKey: "PATHAO",
    trackingNumber: "PT-99999",
    status: "DELIVERED",
    version: 1,
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt: "2026-11-07T00:00:00.000Z",
  },
];

describe("CourierConsignmentsScreen", () => {
  it("renders consignments and filters by courier", () => {
    render(
      <CourierConsignmentsScreen
        orgSlug="test-org"
        organizationId="org-1"
        consignments={mockConsignments}
        labels={mockLabels}
        canRecordSettlement={true}
        canReverseSettlement={true}
      />,
    );

    expect(screen.getByText("ST-12345")).toBeDefined();
    expect(screen.getByText("PT-99999")).toBeDefined();

    const select = screen.getByLabelText("Courier:");
    fireEvent.change(select, { target: { value: "STEADFAST" } });

    expect(screen.getByText("ST-12345")).toBeDefined();
    expect(screen.queryByText("PT-99999")).toBeNull();
  });

  it("opens settlement sheet when record settlement is clicked", () => {
    render(
      <CourierConsignmentsScreen
        orgSlug="test-org"
        organizationId="org-1"
        consignments={mockConsignments}
        labels={mockLabels}
        canRecordSettlement={true}
        canReverseSettlement={true}
      />,
    );

    const button = screen.getByText("Record settlement");
    fireEvent.click(button);

    expect(screen.getByText("Record collected COD cash received from the courier service")).toBeDefined();
  });
});

describe("CourierSettlementSheet", () => {
  it("validates payment IDs and reference before submitting", async () => {
    const recordSpy = vi.spyOn(courierApi, "recordCourierSettlement").mockResolvedValue({
      courierSettlementId: "set-1",
      organizationId: "org-1",
      courierKey: "STEADFAST",
      paymentIds: ["0192e21b-8000-7000-8000-000000000001"],
      grossAmount: { amount: 5000, currency: "BDT" },
      courierCharges: { amount: 100, currency: "BDT" },
      netReceived: { amount: 4900, currency: "BDT" },
      receivedVia: "BANK",
      externalReference: "REF-001",
      businessDate: "2026-11-07",
      reversesCourierSettlementId: null,
      reversalReason: null,
      version: 1,
      createdAt: "2026-11-07T00:00:00.000Z",
    });

    const onOpenChange = vi.fn();

    render(
      <CourierSettlementSheet
        open={true}
        onOpenChange={onOpenChange}
        organizationId="org-1"
        labels={mockLabels}
      />,
    );

    const submitBtn = screen.getByText("Record settlement");
    fireEvent.click(submitBtn);

    expect(recordSpy).not.toHaveBeenCalled();

    const refInput = screen.getByPlaceholderText("e.g. ST-SETTLE-001");
    const payInput = screen.getByPlaceholderText("Enter collection payment IDs");

    fireEvent.change(refInput, { target: { value: "REF-001" } });
    fireEvent.change(payInput, { target: { value: "0192e21b-8000-7000-8000-000000000001" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          courierKey: "STEADFAST",
          externalReference: "REF-001",
          paymentIds: ["0192e21b-8000-7000-8000-000000000001"],
        }),
      );
    });
  });
});

describe("CourierSettlementReverseDialog", () => {
  it("verifies approval token and calls reverseCourierSettlement", async () => {
    const grantSpy = vi.spyOn(paymentApi, "grantApproval").mockResolvedValue({
      approvalToken: "tok-123",
      expiresAt: "2026-11-07T01:00:00.000Z",
    });

    const reverseSpy = vi.spyOn(courierApi, "reverseCourierSettlement").mockResolvedValue({
      courierSettlementId: "set-rev-1",
      organizationId: "org-1",
      courierKey: "STEADFAST",
      paymentIds: [],
      grossAmount: { amount: 0, currency: "BDT" },
      courierCharges: { amount: 0, currency: "BDT" },
      netReceived: { amount: 0, currency: "BDT" },
      receivedVia: "BANK",
      externalReference: "REF-001",
      businessDate: "2026-11-07",
      reversesCourierSettlementId: "set-1",
      reversalReason: "Courier correction",
      version: 2,
      createdAt: "2026-11-07T00:00:00.000Z",
    });

    render(
      <CourierSettlementReverseDialog
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org-1"
        locationId="loc-1"
        courierSettlementId="set-1"
        version={1}
        labels={mockLabels}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter reason for reversal"), {
      target: { value: "Courier correction" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter approver member ID"), {
      target: { value: "mem-mgr" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••"), {
      target: { value: "1234" },
    });

    fireEvent.click(screen.getByText("Reverse settlement"));

    await waitFor(() => {
      expect(grantSpy).toHaveBeenCalledWith("org-1", expect.objectContaining({
        action: "COURIER_SETTLEMENT_REVERSAL",
        subjectKey: "set-1",
        approverMemberId: "mem-mgr",
        pin: "1234",
      }));
      expect(reverseSpy).toHaveBeenCalledWith("org-1", "set-1", {
        version: 1,
        reason: "Courier correction",
        approvalToken: "tok-123",
      });
    });
  });
});
