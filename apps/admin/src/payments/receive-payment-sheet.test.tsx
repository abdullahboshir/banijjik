// @vitest-environment jsdom
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const receivePaymentMock = vi.fn();
vi.mock("./payment-api", () => ({
  receivePayment: (...args: unknown[]) => receivePaymentMock(...args),
}));

const { ReceivePaymentSheet } = await import("./receive-payment-sheet");
const { paymentLabelsOf } = await import("./payment-labels");

const labels = paymentLabelsOf(banglaTranslator().t);
const sheetLabels = {
  ...labels.receiveSheet,
  methodLabels: labels.method,
};

const LOCATIONS = [{ locationId: "loc-1", name: "প্রধান শাখা" }];

describe("ReceivePaymentSheet", () => {
  beforeEach(() => {
    refresh.mockReset();
    receivePaymentMock.mockReset();
  });

  it("shows only the allowed methods in the method select", () => {
    const allowed = [PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH];
    renderInBangla(
      <ReceivePaymentSheet
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        currency="BDT"
        currencySymbol="৳"
        allowedMethods={allowed}
        locations={LOCATIONS}
        labels={sheetLabels}
      />,
    );

    expect(screen.getByRole("option", { name: labels.method.CASH })).toBeDefined();
    expect(screen.getByRole("option", { name: labels.method.BKASH })).toBeDefined();
    expect(screen.queryByRole("option", { name: labels.method.CARD })).toBeNull();
  });

  it("requires reference field when method is BKASH or NAGAD", async () => {
    const user = userEvent.setup();
    renderInBangla(
      <ReceivePaymentSheet
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        currency="BDT"
        currencySymbol="৳"
        allowedMethods={[PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH]}
        locations={LOCATIONS}
        labels={sheetLabels}
      />,
    );

    // Change method to BKASH
    const methodSelect = screen.getByLabelText(sheetLabels.method);
    await user.selectOptions(methodSelect, PAYMENT_METHOD.BKASH);

    // Reference field appears
    expect(screen.getByLabelText(sheetLabels.reference)).toBeDefined();

    // Fill amount 500
    const amountInput = screen.getByLabelText(/পরিমাণ/);
    await user.clear(amountInput);
    await user.type(amountInput, "500");

    // Click submit without reference
    const submitBtn = screen.getByRole("button", { name: sheetLabels.submit });
    await user.click(submitBtn);

    expect(screen.getByText(sheetLabels.referenceRequired)).toBeDefined();
    expect(receivePaymentMock).not.toHaveBeenCalled();
  });

  it("shows overpayment notice for store credit when contact is provided", async () => {
    const user = userEvent.setup();
    renderInBangla(
      <ReceivePaymentSheet
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        currency="BDT"
        currencySymbol="৳"
        allowedMethods={[PAYMENT_METHOD.CASH]}
        locations={LOCATIONS}
        initialAllocations={[
          {
            requestType: "BOOKING",
            requestId: "0192e2b0-8a71-7000-8000-000000000001",
            amount: { amount: 50000, currency: "BDT" },
          },
        ]}
        initialContactId="0192e2b0-8a71-7000-8000-000000000002"
        labels={sheetLabels}
      />,
    );

    // Total allocated is 500, enter amount 600
    const amountInput = screen.getByLabelText(/পরিমাণ/);
    await user.clear(amountInput);
    await user.type(amountInput, "600");

    // Expect overpayment store credit notice
    expect(screen.getByText(/গ্রাহকের স্টোর ক্রেডিটে জমা হবে/)).toBeDefined();
  });

  it("shows cash change notice when overpayment is cash without contact", async () => {
    const user = userEvent.setup();
    renderInBangla(
      <ReceivePaymentSheet
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        currency="BDT"
        currencySymbol="৳"
        allowedMethods={[PAYMENT_METHOD.CASH]}
        locations={LOCATIONS}
        initialAllocations={[
          {
            requestType: "BOOKING",
            requestId: "0192e2b0-8a71-7000-8000-000000000001",
            amount: { amount: 50000, currency: "BDT" },
          },
        ]}
        labels={sheetLabels}
      />,
    );

    // Total allocated is 500, enter amount 600
    const amountInput = screen.getByLabelText(/পরিমাণ/);
    await user.clear(amountInput);
    await user.type(amountInput, "600");

    // Expect cash change notice
    expect(screen.getByText(/ক্যাশ চেঞ্জ/)).toBeDefined();
  });

  it("shows error when non-cash overpayment has no contact", async () => {
    const user = userEvent.setup();
    renderInBangla(
      <ReceivePaymentSheet
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        currency="BDT"
        currencySymbol="৳"
        allowedMethods={[PAYMENT_METHOD.CARD]}
        locations={LOCATIONS}
        initialAllocations={[
          {
            requestType: "BOOKING",
            requestId: "0192e2b0-8a71-7000-8000-000000000001",
            amount: { amount: 50000, currency: "BDT" },
          },
        ]}
        labels={sheetLabels}
      />,
    );

    // Total allocated is 500, enter amount 600
    const amountInput = screen.getByLabelText(/পরিমাণ/);
    await user.clear(amountInput);
    await user.type(amountInput, "600");

    expect(screen.getByText(sheetLabels.overpaymentError)).toBeDefined();
    const submitBtn = screen.getByRole("button", { name: sheetLabels.submit }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });
});
