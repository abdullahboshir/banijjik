import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lineValueMinor, microsToMinor, minorToMicros, movementValue } from "./money-math.js";
import { nextMovingAverage } from "./moving-average.js";

const domainDir = dirname(fileURLToPath(import.meta.url));

describe("moving average in cost micros", () => {
  it("rounds movement value with decimals and sub-minor unit cost half-up consistently", () => {
    // 2.5 units @ 5500 micros (0.55 minor units) -> 2.5 * 0.55 = 1.375 minor units.
    // Half-up rounding on 1.375 minor units:
    // micros = 2.5 * 5500 = 13750 micros. (13750 + 5000) / 10000 = 18750 / 10000 = 1 minor unit.
    // Another case: 3.5 units @ 15000 micros (1.5 minor units) -> 3.5 * 1.5 = 5.25 minor units (52500 micros) -> rounds to 5.
    // Exact half case: 1.5 units @ 10000 micros (1 minor unit) -> 1.5 minor units (15000 micros) -> (15000 + 5000)/10000 = 2 minor units (half-up).
    expect(lineValueMinor(10_000, 1.5)).toBe(2);
    expect(
      movementValue({
        quantityDelta: 1.5,
        unitCostMicros: 10_000,
      }),
    ).toBe(2);

    // Negative delta (e.g. SALE or DAMAGE) produces positive movement value identical to receipt
    expect(
      movementValue({
        quantityDelta: -1.5,
        unitCostMicros: 10_000,
      }),
    ).toBe(2);
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
