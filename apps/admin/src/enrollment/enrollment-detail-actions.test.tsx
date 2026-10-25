// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { formatMoney } from "@banijjik/ui";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaText, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const transitionMock = vi.fn();
vi.mock("./enrollment-api", () => ({
  transitionEnrollment: (...args: unknown[]) => transitionMock(...args),
}));

const { EnrollmentDetailActions } = await import("./enrollment-detail-actions");

const money = (amount: number) => ({ amount, currency: "BDT" as const });

const labels = {
  actions: { activate: "সক্রিয় করুন", freeze: "f", unfreeze: "u", renew: "r", cancel: "c" },
  payHint: banglaText("enrollment.detail.payHint"),
  conflict: banglaText("enrollment.sheet.conflict"),
  reload: banglaText("enrollment.sheet.reload"),
  cancelTitle: "t",
  cancelDescription: "d",
  cancelConfirm: "y",
  cancelKeep: "k",
  cancelClose: "x",
  cancelDone: "d",
  refundable: banglaText("enrollment.cancel.refundable"),
  refundablePeriods: banglaText("enrollment.cancel.refundablePeriods"),
  periodNames: { "period-1": "মেয়াদ ১", "period-2": "মেয়াদ ২" },
  refundLater: "l",
};

describe("EnrollmentDetailActions", () => {
  it("shows the payment-required message and points at the unpaid period when activation is refused", async () => {
    transitionMock.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: "enrollment.errors.payment_required",
        details: undefined,
        requestId: undefined,
        retryAfterSeconds: undefined,
      }),
    );
    renderInBangla(
      <EnrollmentDetailActions
        organizationId="org-1"
        enrollmentId="enrollment-1"
        version={1}
        actions={["activate"]}
        locale="bn"
        labels={labels}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "সক্রিয় করুন" }));
    expect(await screen.findByText(banglaText("enrollment.errors.payment_required"))).toBeDefined();
    expect(screen.getByText(labels.payHint)).toBeDefined();
  });

  it("names each period the cancel left refundable, with its amount", async () => {
    transitionMock.mockResolvedValueOnce({
      enrollment: {},
      refundableAmount: money(50000),
      refundableByPeriod: [
        { enrollmentPeriodId: "period-1", amount: money(0) },
        { enrollmentPeriodId: "period-2", amount: money(50000) },
      ],
    });
    renderInBangla(
      <EnrollmentDetailActions
        organizationId="org-1"
        enrollmentId="enrollment-1"
        version={1}
        actions={["cancel"]}
        locale="bn"
        labels={labels}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "c" }));
    await user.click(await screen.findByRole("button", { name: "y" }));

    expect(await screen.findByText(labels.refundablePeriods)).toBeDefined();
    const refundRow = screen.getByText("মেয়াদ ২").closest("li");
    expect(refundRow?.textContent).toContain(formatMoney(money(50000), { locale: "bn" }));
    expect(screen.queryByText("মেয়াদ ১")).toBeNull();
  });
});
