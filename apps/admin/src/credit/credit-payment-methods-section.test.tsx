// @vitest-environment jsdom
import type { CreditPaymentMethodSetting } from "@banijjik/contracts/credit";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const updateSettingsMock = vi.fn();
vi.mock("../lib/api/tenant-config-api", () => ({
  updateSettings: (...args: unknown[]) => updateSettingsMock(...args),
}));

const { CreditPaymentMethodsSection } = await import("./credit-payment-methods-section");
const { creditPaymentMethodsLabelsOf } = await import("./credit-labels");

const labels = creditPaymentMethodsLabelsOf(banglaTranslator().t);

const INITIAL_METHODS: CreditPaymentMethodSetting[] = [
  {
    method: "BKASH",
    accountNumber: "01711000000",
    accountType: "Merchant",
    instructions: {
      bn: "বিকাশ পেমেন্ট করুন",
      en: "Pay via bKash",
    },
  },
];

describe("CreditPaymentMethodsSection", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateSettingsMock.mockReset();
  });

  it("renders existing payment methods in read-only mode when canUpdate is false", () => {
    renderInBangla(
      <CreditPaymentMethodsSection
        organizationId="org-1"
        methods={INITIAL_METHODS}
        canUpdate={false}
        labels={labels}
      />,
    );

    expect(screen.getByText(labels.title)).toBeDefined();
    expect(screen.getByDisplayValue("01711000000")).toBeDefined();
    expect(screen.queryByText(labels.save)).toBeNull();
    expect(screen.queryByText(labels.add)).toBeNull();
  });

  it("updates an existing method and saves changes", async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockResolvedValueOnce({ settings: {}, definitions: {} });

    renderInBangla(
      <CreditPaymentMethodsSection
        organizationId="org-1"
        methods={INITIAL_METHODS}
        version={1}
        canUpdate
        labels={labels}
      />,
    );

    const accountInput = screen.getByDisplayValue("01711000000");
    await user.clear(accountInput);
    await user.type(accountInput, "01722000000");

    const saveButton = screen.getByRole("button", { name: labels.save });
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledTimes(1);
    });

    expect(updateSettingsMock).toHaveBeenCalledWith("org-1", [
      {
        settingKey: "credit.payment.methods",
        value: [
          {
            method: "BKASH",
            accountNumber: "01722000000",
            accountType: "Merchant",
            instructions: {
              bn: "বিকাশ পেমেন্ট করুন",
              en: "Pay via bKash",
            },
          },
        ],
        version: 1,
      },
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows conflict error when save fails with 409", async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockRejectedValueOnce(
      new ApiError({ status: 409, messageKey: "errors.conflict" }),
    );

    renderInBangla(
      <CreditPaymentMethodsSection
        organizationId="org-1"
        methods={INITIAL_METHODS}
        canUpdate
        labels={labels}
      />,
    );

    const saveButton = screen.getByRole("button", { name: labels.save });
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(labels.conflict);
    });
  });
});
