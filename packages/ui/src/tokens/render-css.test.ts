import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderTokensCss } from "./render-css.js";

const COMMITTED_TOKENS = resolve(import.meta.dirname, "../styles/tokens.css");

describe("tokens.css", () => {
  it("equals the generator output, so a token change without a rebuild fails CI", () => {
    expect(readFileSync(COMMITTED_TOKENS, "utf8")).toBe(renderTokensCss());
  });

  it("applies light values on :root and keeps dark values behind data-theme", () => {
    const css = renderTokensCss();
    expect(css).toMatch(/:root \{[^}]*--color-brand-primary: #0f766e;/);
    expect(css).toMatch(/\[data-theme="dark"\] \{[^}]*--color-brand-primary: #2dd4bf;/);
  });
});
