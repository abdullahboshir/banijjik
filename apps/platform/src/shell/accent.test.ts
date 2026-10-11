import { readFileSync } from "node:fs";
import { join } from "node:path";
import { platformAccentTokens } from "@banijjik/ui";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  join(import.meta.dirname, "..", "..", "app", "globals.css"),
  "utf8",
);

function blockOf(selector: string): string {
  const start = stylesheet.indexOf(`${selector} {`);
  const end = stylesheet.indexOf("}", start);
  return stylesheet.slice(start, end);
}

describe("the platform accent in globals.css", () => {
  it.each([
    [":root", "light"],
    ['[data-theme="dark"]', "dark"],
  ] as const)(
    "overrides the three brand tokens of %s with the vetted %s values",
    (selector, theme) => {
      const block = blockOf(selector).toLowerCase();
      expect(block).toContain(
        `--color-brand-primary: ${platformAccentTokens.primary[theme].toLowerCase()};`,
      );
      expect(block).toContain(
        `--color-brand-primary-hover: ${platformAccentTokens.primaryHover[theme].toLowerCase()};`,
      );
      expect(block).toContain(
        `--color-brand-on-primary: ${platformAccentTokens.onPrimary[theme].toLowerCase()};`,
      );
    },
  );

  it("changes nothing but the brand tokens", () => {
    const declared = [...stylesheet.matchAll(/--color-[a-z-]+:/g)].map((match) => match[0]);
    const unexpected = declared.filter((name) => !name.startsWith("--color-brand-"));
    expect(unexpected).toEqual([]);
  });
});
