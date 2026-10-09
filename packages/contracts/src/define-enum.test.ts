import { describe, expect, it } from "vitest";
import { defineEnum } from "./define-enum.js";

describe("defineEnum", () => {
  it("maps each value to itself", () => {
    expect(defineEnum(["A", "B"])).toEqual({ A: "A", B: "B" });
  });

  it("returns a frozen object", () => {
    expect(Object.isFrozen(defineEnum(["A"]))).toBe(true);
  });
});
