import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toast, Toaster } from "./toast.js";

describe("toast", () => {
  it("shows the message and runs onUndo when the undo action is pressed", async () => {
    const onUndo = vi.fn();
    render(<Toaster label="বিজ্ঞপ্তি" />);
    toast.success("অর্ডার আর্কাইভ করা হয়েছে", { undo: { label: "ফিরিয়ে আনুন", onUndo } });
    await userEvent.click(await screen.findByRole("button", { name: "ফিরিয়ে আনুন" }));
    expect(screen.getByText("অর্ডার আর্কাইভ করা হয়েছে")).not.toBeNull();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("shows an error message without an undo button", async () => {
    render(<Toaster label="বিজ্ঞপ্তি" />);
    toast.error("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন");
    expect(await screen.findByText("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন")).not.toBeNull();
    const errorToast = screen
      .getByText("সংরক্ষণ করা যায়নি, আবার চেষ্টা করুন")
      .closest("li") as HTMLElement;
    expect(within(errorToast).queryByRole("button")).toBeNull();
  });

  it("does not throw when toast() runs before the Toaster has mounted", () => {
    // The app mounts the Toaster lazily (card 0.5b), so an early toast must be safe even if it is not shown.
    expect(() => toast.error("সংরক্ষণ করা যায়নি")).not.toThrow();
  });
});
