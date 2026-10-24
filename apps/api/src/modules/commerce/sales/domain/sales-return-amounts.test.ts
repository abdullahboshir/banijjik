import { describe, expect, it } from "vitest";
import {
  deliveryChargeReturnedMinor,
  returnLineShare,
  roundingReturnedMinor,
} from "./sales-return-amounts.js";

const threeUnitLine = { soldQuantity: 3, lineNetTotalMinor: 1000, lineTaxMinor: 0 };

describe("return line values", () => {
  it("values a partial return from the stored line total and gives the last unit the remainder", () => {
    const values = [0, 1, 2].map(
      (returnedBefore) =>
        returnLineShare({ ...threeUnitLine, returnedBefore, quantity: 1 }).valueMinor,
    );
    expect(values).toEqual([333, 333, 334]);
  });

  it("splits the tax part the same way", () => {
    const taxes = [0, 1, 2].map(
      (returnedBefore) =>
        returnLineShare({
          soldQuantity: 3,
          lineNetTotalMinor: 1000,
          lineTaxMinor: 100,
          returnedBefore,
          quantity: 1,
        }).taxPartMinor,
    );
    expect(taxes).toEqual([33, 33, 34]);
  });

  it("returns the rounding adjustment only with the return that empties the order", () => {
    expect(
      roundingReturnedMinor({ everyLineFullyReturned: false, roundingAdjustmentMinor: -2 }),
    ).toBe(0);
    expect(
      roundingReturnedMinor({ everyLineFullyReturned: true, roundingAdjustmentMinor: -2 }),
    ).toBe(-2);
  });

  it("returns the delivery charge only when the return asks, and never twice", () => {
    expect(
      deliveryChargeReturnedMinor({
        returnDeliveryCharge: false,
        orderDeliveryChargeMinor: 60,
        deliveryReturnedBeforeMinor: 0,
      }),
    ).toBe(0);
    expect(
      deliveryChargeReturnedMinor({
        returnDeliveryCharge: true,
        orderDeliveryChargeMinor: 60,
        deliveryReturnedBeforeMinor: 60,
      }),
    ).toBe(0);
  });
});
