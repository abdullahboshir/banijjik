// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { APPROVAL_ACTION, type ApproverSummary } from "@banijjik/contracts/iam";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";
import { orderLabelsOf } from "./order-labels";
import { useOrderApprovalFlow, type OrderApprovalAction } from "./order-approval";
import { OrderApprovalDialog } from "./order-approval-dialog";

const listApproversMock = vi.fn();
const grantApprovalMock = vi.fn();
vi.mock("../payments/payment-api", () => ({
  listApprovers: (...args: unknown[]) => listApproversMock(...args),
  grantApproval: (...args: unknown[]) => grantApprovalMock(...args),
}));

const labels = orderLabelsOf(banglaTranslator().t).approval;
const APPROVER: ApproverSummary = {
  memberId: "member-1",
  displayName: "ম্যানেজার সাহেব",
  hasPin: true,
};
const REQUEST = {
  subjectKey: "order:order-1",
  locationId: "location-1",
  amount: { amount: 2500, currency: "BDT" as const },
};

function approvalRequired(): ApiError {
  return new ApiError({
    status: 403,
    code: ERROR_CODE.APPROVAL_REQUIRED,
    messageKey: "errors.internal",
  });
}

function Harness(props: {
  readonly action: OrderApprovalAction;
  readonly onApproved: () => void;
  readonly onFailure: (error: unknown) => void;
}): ReactElement {
  const flow = useOrderApprovalFlow({
    organizationId: "org-1",
    labels,
    onFailure: props.onFailure,
  });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void flow
            .attempt(REQUEST, props.action, props.onApproved)
            .catch((error: unknown) => props.onFailure(error));
        }}
      >
        শুরু
      </button>
      <OrderApprovalDialog flow={flow} labels={labels} />
    </>
  );
}

beforeEach(() => {
  listApproversMock.mockReset();
  grantApprovalMock.mockReset();
});

afterEach(cleanup);

describe("the order approval flow", () => {
  it("runs the action without asking for a PIN when no approval is needed", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue(undefined);
    const onApproved = vi.fn();
    renderInBangla(<Harness action={action} onApproved={onApproved} onFailure={() => {}} />);

    await user.click(screen.getByRole("button", { name: "শুরু" }));

    await waitFor(() => {
      expect(onApproved).toHaveBeenCalledTimes(1);
    });
    expect(action).toHaveBeenCalledWith(undefined);
    expect(listApproversMock).not.toHaveBeenCalled();
    expect(screen.queryByText(labels.title)).toBeNull();
  });

  it("opens the PIN dialog after APPROVAL_REQUIRED and retries with the granted token", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockRejectedValueOnce(approvalRequired())
      .mockResolvedValueOnce(undefined);
    const onApproved = vi.fn();
    listApproversMock.mockResolvedValueOnce([APPROVER]);
    grantApprovalMock.mockResolvedValueOnce({
      approvalToken: "approval-token-1",
      expiresAt: "2026-10-24T11:00:00.000Z",
    });
    renderInBangla(<Harness action={action} onApproved={onApproved} onFailure={() => {}} />);

    await user.click(screen.getByRole("button", { name: "শুরু" }));

    expect(await screen.findByText(labels.title)).toBeDefined();
    expect(screen.getByText(APPROVER.displayName)).toBeDefined();

    fireEvent.change(screen.getByLabelText(labels.pin), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: labels.submit }));

    await waitFor(() => {
      expect(grantApprovalMock).toHaveBeenCalledWith("org-1", {
        action: APPROVAL_ACTION.DISCOUNT,
        subjectKey: REQUEST.subjectKey,
        amount: REQUEST.amount,
        locationId: REQUEST.locationId,
        approverMemberId: APPROVER.memberId,
        pin: "1234",
      });
      expect(action).toHaveBeenLastCalledWith("approval-token-1");
      expect(onApproved).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByText(labels.title)).toBeNull();
    });
  });

  it("reports that no approver can sign when the list is empty", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValue(approvalRequired());
    const onFailure = vi.fn();
    listApproversMock.mockResolvedValueOnce([]);
    renderInBangla(<Harness action={action} onApproved={() => {}} onFailure={onFailure} />);

    await user.click(screen.getByRole("button", { name: "শুরু" }));

    await waitFor(() => {
      expect(onFailure).toHaveBeenCalledWith(new Error(labels.noApprovers));
    });
    expect(screen.queryByText(labels.title)).toBeNull();
  });

  it("keeps the dialog open with a message when the PIN is refused", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockRejectedValue(approvalRequired());
    const translated = banglaTranslator().t("errors.internal");
    listApproversMock.mockResolvedValueOnce([APPROVER]);
    grantApprovalMock.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        code: ERROR_CODE.APPROVAL_INVALID,
        messageKey: "errors.internal",
      }),
    );
    renderInBangla(<Harness action={action} onApproved={() => {}} onFailure={() => {}} />);

    await user.click(screen.getByRole("button", { name: "শুরু" }));
    expect(await screen.findByText(labels.title)).toBeDefined();

    fireEvent.change(screen.getByLabelText(labels.pin), { target: { value: "0000" } });
    fireEvent.click(screen.getByRole("button", { name: labels.submit }));

    expect(await screen.findByText(translated)).toBeDefined();
    expect(screen.getByText(labels.title)).toBeDefined();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
