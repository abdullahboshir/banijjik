import { describe, expect, it } from "vitest";
import { termLabel } from "./term-label.js";

const TERMS = { location: { bn: "আউটলেট", en: "Outlet" } };

describe("termLabel", () => {
  it("uses the term in the user's language", () => {
    expect(termLabel(TERMS, "location", { locale: "bn", fallback: "শাখা" })).toBe("আউটলেট");
    expect(termLabel(TERMS, "location", { locale: "en", fallback: "Branch" })).toBe("Outlet");
  });

  it("falls back when the business has no such term", () => {
    expect(termLabel({}, "location", { locale: "bn", fallback: "শাখা" })).toBe("শাখা");
    expect(termLabel(TERMS, "contact", { locale: "en", fallback: "Customer" })).toBe("Customer");
  });

  it("falls back when only the other language has a text, or the text is blank", () => {
    expect(
      termLabel({ location: { en: "Outlet" } }, "location", { locale: "bn", fallback: "শাখা" }),
    ).toBe("শাখা");
    expect(
      termLabel({ location: { bn: "   ", en: "Outlet" } }, "location", {
        locale: "bn",
        fallback: "শাখা",
      }),
    ).toBe("শাখা");
  });

  it("never reads the prototype for a key like constructor", () => {
    expect(termLabel({}, "constructor", { locale: "en", fallback: "fallback" })).toBe("fallback");
  });
});
