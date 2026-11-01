import { describe, expect, it } from "vitest";
import { translatorFor } from "./client-translator";

describe("translatorFor", () => {
  it("returns the same translator object for repeated calls with one locale", () => {
    expect(translatorFor("bn")).toBe(translatorFor("bn"));
    expect(translatorFor("en")).toBe(translatorFor("en"));
  });

  it("returns different translators for bn and en, each in its own language", () => {
    const bangla = translatorFor("bn").t("storefront.cart.title");
    const english = translatorFor("en").t("storefront.cart.title");

    expect(translatorFor("bn")).not.toBe(translatorFor("en"));
    expect(english).toBe("Cart");
    expect(bangla).not.toBe(english);
  });
});
