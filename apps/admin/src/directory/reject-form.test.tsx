// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RejectForm } from "./reject-form";

const REASONS = [
  {
    reasonKey: "unclear",
    label: { bn: "অস্পষ্ট", en: "Unclear" },
    isFinal: false,
  },
  {
    reasonKey: "false_info",
    label: { bn: "মিথ্যা", en: "False" },
    isFinal: true,
  },
] as const;

const LABELS = {
  title: "Reject",
  reasons: "Reasons",
  finalMark: "Final",
  note: "Note",
  submit: "Submit reject",
  cancel: "Cancel",
  reasonRequired: "Choose a reason",
};

describe("RejectForm", () => {
  it("marks final reasons and requires a reason before submit", async () => {
    const onSubmit = vi.fn();
    render(
      <RejectForm
        reasons={REASONS}
        locale="en"
        labels={LABELS}
        busy={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText("Final")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Submit reject" }));
    expect(screen.getByText("Choose a reason")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText(/Unclear/u));
    await userEvent.click(screen.getByRole("button", { name: "Submit reject" }));
    expect(onSubmit).toHaveBeenCalledWith({ reasonKeys: ["unclear"] });
  });
});
