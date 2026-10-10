import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sheet, SheetContent } from "./sheet.js";

describe("SheetContent", () => {
  it("puts the overlay and the content on the same layer (review J3)", () => {
    render(
      <Sheet open>
        <SheetContent title="Menu" closeLabel="Close">
          body
        </SheetContent>
      </Sheet>,
    );
    const content = screen.getByRole("dialog");
    const overlay = document.querySelector("[data-state='open'].fixed.inset-0");
    expect(overlay?.className).toContain("z-sheet");
    expect(content.className).toContain("z-sheet");
    expect(content.className).not.toContain("z-dialog");
  });
});
