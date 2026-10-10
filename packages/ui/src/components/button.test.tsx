import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";

describe("Button", () => {
  it("is a plain button that does not submit unless asked", () => {
    render(<Button>সংরক্ষণ করুন</Button>);
    const button = screen.getByRole("button", { name: "সংরক্ষণ করুন" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("aria-busy")).toBeNull();
  });

  it("is disabled and busy while loading, and keeps its label", () => {
    render(<Button isLoading>সংরক্ষণ করুন</Button>);
    const button = screen.getByRole("button", { name: "সংরক্ষণ করুন" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
