import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicImage } from "./public-image.js";

describe("PublicImage", () => {
  it("draws the picture with its text alternative and loads it lazily", () => {
    render(<PublicImage src="/photo.webp" alt="Rice bag" className="size-14" />);

    const image = screen.getByAltText("Rice bag");
    expect(image.getAttribute("src")).toBe("/photo.webp");
    expect(image.getAttribute("loading")).toBe("lazy");
  });
});
