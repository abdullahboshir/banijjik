import { describe, expect, it } from "vitest";
import { isUnitKey, UNIT_DIMENSION, UNIT_KEY, UNITS } from "./unit-registry.js";

describe("the unit registry", () => {
  it("defines every unit key exactly once", () => {
    expect(Object.keys(UNITS).sort()).toEqual(Object.values(UNIT_KEY).sort());
    for (const [unitKey, unit] of Object.entries(UNITS)) expect(unit.unitKey).toBe(unitKey);
  });

  it("counts things in whole numbers", () => {
    for (const unitKey of [UNIT_KEY.PIECE, UNIT_KEY.SET, UNIT_KEY.PAIR, UNIT_KEY.BOX]) {
      expect(UNITS[unitKey]).toMatchObject({ dimension: UNIT_DIMENSION.COUNT, precision: 0 });
    }
  });

  it("measures weight and volume down to the base unit: 1.25 kg is 1250 grams", () => {
    expect(UNITS.KG).toMatchObject({ precision: 3, factorToBase: 1000 });
    expect(UNITS.GRAM).toMatchObject({ precision: 0, factorToBase: 1 });
    expect(UNITS.LITRE).toMatchObject({ precision: 3, factorToBase: 1000 });
  });

  it("keeps every factor a positive integer and every precision a small whole number", () => {
    for (const unit of Object.values(UNITS)) {
      expect(Number.isInteger(unit.factorToBase) && unit.factorToBase > 0).toBe(true);
      expect(Number.isInteger(unit.precision) && unit.precision >= 0 && unit.precision <= 3).toBe(
        true,
      );
    }
  });

  it("has no dozen: a dozen is a pack, not a unit", () => {
    expect(isUnitKey("DOZEN")).toBe(false);
    expect(isUnitKey("KG")).toBe(true);
  });
});
