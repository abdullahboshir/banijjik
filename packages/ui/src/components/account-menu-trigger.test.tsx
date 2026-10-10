import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountMenuTrigger } from "./account-menu-trigger.js";

describe("AccountMenuTrigger", () => {
  it("is named by its label, not by the initials", async () => {
    const onClick = vi.fn();
    render(<AccountMenuTrigger initials="রউ" label="অ্যাকাউন্ট" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "অ্যাকাউন্ট" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
