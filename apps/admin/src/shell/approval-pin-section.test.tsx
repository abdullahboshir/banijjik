// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { banglaText, renderInBangla } from "../auth/test-helpers";
import { ApprovalPinSection } from "./approval-pin-section";

vi.mock("./approval-pin-api", () => ({
  setApprovalPin: vi.fn(async () => undefined),
  removeApprovalPin: vi.fn(async () => undefined),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ApprovalPinSection", () => {
  it("saves a PIN with the current password", async () => {
    const { setApprovalPin } = await import("./approval-pin-api");
    renderInBangla(<ApprovalPinSection organizationId="org-1" />);
    fireEvent.change(screen.getByLabelText(banglaText("account.approvalPin.currentPassword")), {
      target: { value: "Secret1!" },
    });
    fireEvent.change(screen.getByLabelText(banglaText("account.approvalPin.pin")), {
      target: { value: "1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: banglaText("account.approvalPin.save") }));
    await waitFor(() => {
      expect(setApprovalPin).toHaveBeenCalledWith("org-1", {
        currentPassword: "Secret1!",
        pin: "1234",
      });
    });
  });
});
