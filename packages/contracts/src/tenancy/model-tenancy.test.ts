import { describe, expect, it } from "vitest";
import { MODEL_TENANCY } from "./model-tenancy.js";

describe("MODEL_TENANCY", () => {
  it("offers exactly the three tenancy levels", () => {
    expect(Object.values(MODEL_TENANCY)).toEqual([
      "NONE",
      "ORGANIZATION",
      "ORGANIZATION_AND_LOCATION",
    ]);
  });
});
