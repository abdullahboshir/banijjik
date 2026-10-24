import { describe, expect, it } from "vitest";
import { themeStyle } from "./theme";

describe("site theme", () => {
  it("writes the business colours into the brand tokens and ignores a colour that is not a hex code", () => {
    const style = themeStyle({ primary: "#1F6F5C", accent: "teal" });

    expect(style).toEqual({ "--color-brand-primary": "#1F6F5C" });
  });

  it("keeps the platform colours when the business has none", () => {
    expect(themeStyle(undefined)).toEqual({});
  });
});
