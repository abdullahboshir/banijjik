import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalPinDialog } from "./approval-pin-dialog.js";

afterEach(cleanup);

const approvers = [
  { memberId: "m1", displayName: "Manager One", hasPin: true },
  { memberId: "m2", displayName: "Manager Two", hasPin: false },
];

function renderDialog(
  overrides: Partial<Parameters<typeof ApprovalPinDialog>[0]> = {},
): ReturnType<typeof render> {
  return render(
    <ApprovalPinDialog
      open
      onOpenChange={() => undefined}
      title="Manager approval"
      approverLabel="Approver"
      pinLabel="PIN"
      submitLabel="Approve"
      cancelLabel="Cancel"
      closeLabel="Close"
      lockedMessage="This PIN is locked. Try again later."
      approvers={approvers}
      onSubmit={() => undefined}
      {...overrides}
    />,
  );
}

describe("ApprovalPinDialog", () => {
  it("types digits from the phone keypad into the PIN field", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(screen.getByLabelText("PIN")).toHaveValue("1234");
  });

  it("shows the lock message and disables submit when locked", () => {
    renderDialog({ isLocked: true });
    expect(screen.getByRole("alert")).toHaveTextContent("This PIN is locked");
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });

  it("submits the selected approver and PIN", () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });
    fireEvent.change(screen.getByLabelText("PIN"), { target: { value: "5678" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onSubmit).toHaveBeenCalledWith({ approverMemberId: "m1", pin: "5678" });
  });
});
