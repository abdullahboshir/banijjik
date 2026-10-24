import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lineValueMinor, microsToMinor, minorToMicros, movementValue } from "./money-math.js";
import { nextMovingAverage } from "./moving-average.js";

const domainDir = dirname(fileURLToPath(import.meta.url));

describe("moving average in cost micros", () => {
  it("computes movement value with integer precision and rounds sub-minor unit cost half-up consistently", () => {
    // 1,500 g @ 5,000 micros/g (0.5 paisa/g) = 7,500,000 micros -> 750 minor units (৳7.50)
    expect(lineValueMinor(5000, 1500)).toBe(750);
    expect(
      movementValue({
        quantityDelta: 1500,
        unitCostMicros: 5000,
      }),
    ).toBe(750);

    // Negative delta (e.g. SALE or DAMAGE) produces positive movement value identical to receipt
    expect(
      movementValue({
        quantityDelta: -1500,
        unitCostMicros: 5000,
      }),
    ).toBe(750);

    // Sub-minor rounding: 3 g @ 5000 micros/g = 15000 micros -> (15000 + 5000)/10000 = 2 minor units (half-up)
    expect(lineValueMinor(5000, 3)).toBe(2);

    // Rejects fractional quantities (ADR-047)
    expect(() => lineValueMinor(5000, 1.5)).toThrow(DomainRuleError);
    try {
      lineValueMinor(5000, 1.5);
    } catch (error) {
      expect((error as DomainRuleError).code).toBe(ERROR_CODE.INTERNAL);
    }
  });

  it("keeps ৳5/kg rice (0.5 paisa/gram) exact after a gram receipt", () => {
    // ৳5/kg = 500 paisa / 1000 g = 0.5 paisa/g = 5000 micros/g
    const averageMicros = nextMovingAverage({
      onHand: 0,
      averageUnitCostMicros: 0,
      incomingQuantity: 1000,
      incomingUnitCostMicros: 5000,
    });
    expect(averageMicros).toBe(5000);
    expect(lineValueMinor(averageMicros, 1000)).toBe(500);
    // Display rounding to whole paisa is 1; inventory value stays exact.
    expect(microsToMinor(averageMicros)).toBe(1);
  });

  it("weights two receipts exactly (1000 @ 50 + 500 @ 80 → 60)", () => {
    const afterFirst = nextMovingAverage({
      onHand: 0,
      averageUnitCostMicros: 0,
      incomingQuantity: 1000,
      incomingUnitCostMicros: minorToMicros(50),
    });
    const afterSecond = nextMovingAverage({
      onHand: 1000,
      averageUnitCostMicros: afterFirst,
      incomingQuantity: 500,
      incomingUnitCostMicros: minorToMicros(80),
    });
    expect(afterSecond).toBe(minorToMicros(60));
    expect(microsToMinor(afterSecond)).toBe(60);
    expect(lineValueMinor(afterSecond, 1500)).toBe(90_000);
  });

  it("keeps float Math out of the money helpers (BigInt only)", () => {
    for (const fileName of ["moving-average.ts", "money-math.ts"]) {
      const source = readFileSync(join(domainDir, fileName), "utf8");
      expect(source, fileName).not.toMatch(/Math\./);
    }
  });
});
