import { describe, expect, it } from "vitest";
import { assertKnownCustomFieldEntities } from "./declared-entities.js";

describe("custom field entity startup check", () => {
  it("accepts a manifest whose entities are in the enum", () => {
    expect(() =>
      assertKnownCustomFieldEntities([{ key: "contact", customFieldEntities: ["contact"] }]),
    ).not.toThrow();
  });

  it("refuses to start when a manifest names an entity outside the enum", () => {
    expect(() =>
      assertKnownCustomFieldEntities([{ key: "billing", customFieldEntities: ["invoice"] }]),
    ).toThrow(/invoice/);
  });
});
