import { describe, expect, it } from "vitest";
import {
  canSellLoose,
  looseCountingUnit,
  quantityRuleFromText,
  quantityRuleToText,
} from "./quantity-rule";

describe("the loose rule", () => {
  it("offers loose selling only for weight, volume and length units", () => {
    expect(canSellLoose("KG")).toBe(true);
    expect(canSellLoose("LITRE")).toBe(true);
    expect(canSellLoose("PIECE")).toBe(false);
    expect(canSellLoose("SESSION")).toBe(false);
  });

  it("counts kilograms in grams, litres in millilitres and metres in centimetres", () => {
    expect(looseCountingUnit("KG")).toBe("GRAM");
    expect(looseCountingUnit("LITRE")).toBe("ML");
    expect(looseCountingUnit("METRE")).toBe("CM");
    expect(looseCountingUnit("GRAM")).toBe("GRAM");
  });

  it("turns 250 g steps into the integer rule the API stores", () => {
    expect(quantityRuleFromText({ min: "250", step: "250" })).toEqual({ min: 250, step: 250 });
    expect(quantityRuleFromText({ min: "৫০০", step: "২৫০" })).toEqual({ min: 500, step: 250 });
  });

  it("refuses a minimum below the step, zero and text", () => {
    expect(quantityRuleFromText({ min: "100", step: "250" })).toBeUndefined();
    expect(quantityRuleFromText({ min: "0", step: "0" })).toBeUndefined();
    expect(quantityRuleFromText({ min: "a", step: "1" })).toBeUndefined();
  });

  it("shows a stored rule as text and an absent rule as empty fields", () => {
    expect(quantityRuleToText({ min: 500, step: 250 })).toEqual({ min: "500", step: "250" });
    expect(quantityRuleToText(null)).toEqual({ min: "", step: "" });
  });
});
