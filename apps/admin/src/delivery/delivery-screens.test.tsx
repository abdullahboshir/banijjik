// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { DeliveryAssignmentResponse } from "@banijjik/contracts/delivery";
import { DeliveryAssignmentsScreen } from "./delivery-assignments-screen";
import { RiderHandoverSheet } from "./rider-handover-sheet";
import { RiderHandoverReverseDialog } from "./rider-handover-reverse-dialog";
import * as deliveryApi from "./delivery-api";
import * as paymentApi from "../payments/payment-api";
import type { DeliveryLabels } from "./delivery-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("./delivery-toast", () => ({
  showSuccessToast: vi.fn(),
}));

const mockLabels: DeliveryLabels = {
  title: "Delivery assignments",
  subtitle: "Track rider delivery assignments and cash handovers",
  empty: "No delivery assignments found",
  rider: "Rider",
  orderId: "Order ID",
  status: "Status",
  statusAll: "All statuses",
  location: "Location",
  notes: "Notes",
  created: "Created",
  recordHandover: "Record cash handover",
  reverseHandover: "Reverse cash handover",
  close: "Close",
  handover: {
    title: "Record rider cash handover",
    description: "Record cash received from a delivery rider for completed COD orders",
    rider: "Rider member",
    receivedVia: "Received via",
    businessDate: "Business date",
    posSessionId: "POS session (optional)",
    posSessionPlaceholder: "POS session ID",
    payments: "Payment IDs",
    paymentsPlaceholder: "Enter collection payment IDs",
    submit: "Record handover",
    success: "Rider cash handover recorded successfully",
  },
  reverse: {
    title: "Reverse rider cash handover",
    description: "Reversing this cash handover re-opens collection claims",
    reason: "Reversal reason",
    reasonPlaceholder: "Enter reason for reversal",
    submit: "Reverse handover",
    success: "Rider cash handover reversed",
  },
};

const mockAssignments: DeliveryAssignmentResponse[] = [
  {
    deliveryAssignmentId: "as-1",
    organizationId: "org-1",
    locationId: "loc-1",
    orderId: "ord-1",
    riderMemberId: "mem-rider-1",
    attemptOrdinal: 1,
    status: "ASSIGNED",
    notes: "Leave at front desk",
    version: 1,
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt: "2026-11-07T00:00:00.000Z",
  },
  {
    deliveryAssignmentId: "as-2",
    organizationId: "org-1",
    locationId: "loc-1",
    orderId: "ord-2",
    riderMemberId: "mem-rider-2",
    attemptOrdinal: 1,
    status: "DELIVERED",
    notes: null,
    version: 1,
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt: "2026-11-07T00:00:00.000Z",
  },
];

describe("DeliveryAssignmentsScreen", () => {
  it("renders assignments and filters by status", () => {
    render(
      <DeliveryAssignmentsScreen
        orgSlug="test-org"
        organizationId="org-1"
        assignments={mockAssignments}
        labels={mockLabels}
        canRecordHandover={true}
        canReverseHandover={true}
      />,
    );

    expect(screen.getByText("ord-1")).toBeDefined();
    expect(screen.getByText("ord-2")).toBeDefined();

    const select = screen.getByLabelText("Status:");
    fireEvent.change(select, { target: { value: "DELIVERED" } });

    expect(screen.queryByText("ord-1")).toBeNull();
    expect(screen.getByText("ord-2")).toBeDefined();
  });

  it("opens handover sheet when record handover is clicked", () => {
    render(
      <DeliveryAssignmentsScreen
        orgSlug="test-org"
        organizationId="org-1"
        assignments={mockAssignments}
        labels={mockLabels}
        canRecordHandover={true}
        canReverseHandover={true}
      />,
    );

    const button = screen.getByText("Record cash handover");
    fireEvent.click(button);

    expect(
      screen.getByText("Record cash received from a delivery rider for completed COD orders"),
    ).toBeDefined();
  });
});

describe("RiderHandoverSheet", () => {
  it("validates payment IDs and rider ID before submitting", async () => {
    const recordSpy = vi.spyOn(deliveryApi, "recordRiderCashHandover").mockResolvedValue({
      riderCashHandoverId: "h-1",
      organizationId: "org-1",
      locationId: "loc-1",
      riderMemberId: "0192e21b-8000-7000-8000-000000000001",
      receivedByMemberId: "0192e21b-8000-7000-8000-000000000002",
      paymentIds: ["0192e21b-8000-7000-8000-000000000003"],
      amount: { amount: 5000, currency: "BDT" },
      receivedVia: "CASH",
      posSessionId: null,
      businessDate: "2026-11-07",
      reversesRiderCashHandoverId: null,
      reversalReason: null,
      version: 1,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    });

    const onOpenChange = vi.fn();

    render(
      <RiderHandoverSheet
        open={true}
        onOpenChange={onOpenChange}
        organizationId="org-1"
        labels={mockLabels}
      />,
    );

    const submitBtn = screen.getByText("Record handover");
    fireEvent.click(submitBtn);

    expect(recordSpy).not.toHaveBeenCalled();

    const riderInput = screen.getByPlaceholderText("Enter rider member ID");
    const payInput = screen.getByPlaceholderText("Enter collection payment IDs");

    fireEvent.change(riderInput, { target: { value: "0192e21b-8000-7000-8000-000000000001" } });
    fireEvent.change(payInput, { target: { value: "0192e21b-8000-7000-8000-000000000003" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({
          riderMemberId: "0192e21b-8000-7000-8000-000000000001",
          paymentIds: ["0192e21b-8000-7000-8000-000000000003"],
          receivedVia: "CASH",
        }),
      );
    });
  });
});

describe("RiderHandoverReverseDialog", () => {
  it("verifies approval token and calls reverseRiderCashHandover", async () => {
    const grantSpy = vi.spyOn(paymentApi, "grantApproval").mockResolvedValue({
      approvalToken: "tok-456",
      expiresAt: "2026-11-07T01:00:00.000Z",
    });

    const reverseSpy = vi.spyOn(deliveryApi, "reverseRiderCashHandover").mockResolvedValue({
      riderCashHandoverId: "h-rev-1",
      organizationId: "org-1",
      locationId: "loc-1",
      riderMemberId: "0192e21b-8000-7000-8000-000000000001",
      receivedByMemberId: "0192e21b-8000-7000-8000-000000000002",
      paymentIds: [],
      amount: { amount: 0, currency: "BDT" },
      receivedVia: "CASH",
      posSessionId: null,
      businessDate: "2026-11-07",
      reversesRiderCashHandoverId: "h-1",
      reversalReason: "Rider correction",
      version: 2,
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    });

    render(
      <RiderHandoverReverseDialog
        open={true}
        onOpenChange={vi.fn()}
        organizationId="org-1"
        locationId="loc-1"
        riderCashHandoverId="h-1"
        version={1}
        labels={mockLabels}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Enter reason for reversal"), {
      target: { value: "Rider correction" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter approver member ID"), {
      target: { value: "mem-mgr" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••"), {
      target: { value: "1234" },
    });

    fireEvent.click(screen.getByText("Reverse handover"));

    await waitFor(() => {
      expect(grantSpy).toHaveBeenCalledWith("org-1", expect.objectContaining({
        action: "RIDER_HANDOVER_REVERSAL",
        subjectKey: "h-1",
        approverMemberId: "mem-mgr",
        pin: "1234",
      }));
      expect(reverseSpy).toHaveBeenCalledWith("org-1", "h-1", {
        version: 1,
        reason: "Rider correction",
        approvalToken: "tok-456",
      });
    });
  });
});
