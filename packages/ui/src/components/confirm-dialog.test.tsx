import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog.js";

function renderDialog(handlers: { onConfirm: () => void; onOpenChange: (open: boolean) => void }) {
  return render(
    <ConfirmDialog
      open
      title="অর্ডারটি বাতিল করতে চান?"
      description="এই কাজটি আর ফেরানো যাবে না"
      amount={{ money: { amount: 125050, currency: "BDT" }, locale: "bn" }}
      confirmLabel="হ্যাঁ, বাতিল করুন"
      cancelLabel="না, থাক"
      closeLabel="বন্ধ করুন"
      tone="danger"
      {...handlers}
    />,
  );
}

describe("ConfirmDialog", () => {
  it("shows the formatted amount", () => {
    renderDialog({ onConfirm: vi.fn(), onOpenChange: vi.fn() });
    expect(screen.getByText("৳ 1,250.50")).not.toBeNull();
  });

  it("calls onConfirm once when the confirm button is pressed", async () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm, onOpenChange: vi.fn() });
    await userEvent.click(screen.getByRole("button", { name: "হ্যাঁ, বাতিল করুন" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("asks to close when Escape is pressed, without confirming", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm, onOpenChange });
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes through the cancel button", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onConfirm: vi.fn(), onOpenChange });
    await userEvent.click(screen.getByRole("button", { name: "না, থাক" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
