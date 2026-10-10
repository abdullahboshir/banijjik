import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { breakpointTokens } from "../tokens/index.js";

const THEME_CSS = readFileSync(resolve(import.meta.dirname, "theme.css"), "utf8");

describe("theme.css breakpoints", () => {
  it.each(Object.entries(breakpointTokens))(
    "uses the literal %s breakpoint value because var() is invalid inside a media query",
    (name, value) => {
      expect(THEME_CSS).toContain(`--breakpoint-${name}: ${value};`);
    },
  );

  it("never maps a breakpoint to a CSS variable", () => {
    expect(THEME_CSS).not.toMatch(/--breakpoint-[a-z]+:\s*var\(/);
  });
});
