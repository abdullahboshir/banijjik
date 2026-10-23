// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
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

const { PaymentMethodsSection } = await import("./payment-methods-section");
const { paymentLabelsOf } = await import("./payment-labels");

const labels = paymentLabelsOf(banglaTranslator().t);
const sectionLabels = {
  ...labels.settings,
  methodLabels: labels.method,
};

const INITIAL_METHODS = [PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH];

describe("PaymentMethodsSection", () => {
  beforeEach(() => {
    refresh.mockReset();
    updateSettingsMock.mockReset();
  });

  it("renders enabled payment methods in read-only mode when canUpdate is false", () => {
    renderInBangla(
      <PaymentMethodsSection
        organizationId="org-1"
        methods={INITIAL_METHODS}
        canUpdate={false}
        labels={sectionLabels}
      />,
    );

    expect(screen.getByText(sectionLabels.title)).toBeDefined();
    const cashCheckbox = screen.getByLabelText(labels.method.CASH) as HTMLInputElement;
    expect(cashCheckbox.checked).toBe(true);
    expect(cashCheckbox.disabled).toBe(true);
    expect(screen.queryByText(sectionLabels.save)).toBeNull();
  });

  it("toggles methods and saves updated settings", async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockResolvedValueOnce({ settings: {}, definitions: {} });

    renderInBangla(
      <PaymentMethodsSection
        organizationId="org-1"
        methods={INITIAL_METHODS}
        version={1}
        canUpdate
        labels={sectionLabels}
      />,
    );

    const nagadCheckbox = screen.getByLabelText(labels.method.NAGAD) as HTMLInputElement;
    expect(nagadCheckbox.checked).toBe(false);

    await user.click(nagadCheckbox);
    expect(nagadCheckbox.checked).toBe(true);

    const saveButton = screen.getByText(sectionLabels.save);
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith("org-1", [
        {
          settingKey: "payment.methods",
          value: [PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH, PAYMENT_METHOD.NAGAD],
          version: 1,
        },
      ]);
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(screen.getByText(sectionLabels.saved)).toBeDefined();
    });
  });

  it("displays conflict error when setting update returns 409", async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: ERROR_CODE.CONFLICT,
        messageKey: "errors.setting_conflict",
      }),
    );

    renderInBangla(
      <PaymentMethodsSection
        organizationId="org-1"
        methods={INITIAL_METHODS}
        version={1}
        canUpdate
        labels={sectionLabels}
      />,
    );

    const saveButton = screen.getByText(sectionLabels.save);
    await user.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(sectionLabels.conflict)).toBeDefined();
    });
  });
});
