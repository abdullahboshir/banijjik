import { describe, expect, it } from "vitest";
import { applyClearableChange, applyClearableChanges } from "./clearable.js";

describe("applyClearableChange", () => {
  it("sets a value, clears with null, and keeps the stored value when the change is absent", () => {
    expect(applyClearableChange("old", "new")).toBe("new");
    expect(applyClearableChange("old", null)).toBeUndefined();
    expect(applyClearableChange("old", undefined)).toBe("old");
    expect(applyClearableChange(undefined, undefined)).toBeUndefined();
  });
});

describe("applyClearableChanges", () => {
  interface Fields {
    legalName?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
  }
  const stored: Fields = { legalName: "Rahim Ltd", email: "a@b.com" };

  it("sets, clears and leaves fields alone in one pass, without mutating the stored object", () => {
    const result = applyClearableChanges(stored, { legalName: null, phone: "+8801712345678" });

    expect(result).toEqual({ email: "a@b.com", phone: "+8801712345678" });
    expect(result).not.toHaveProperty("legalName");
    expect(stored).toEqual({ legalName: "Rahim Ltd", email: "a@b.com" });
  });

  it("treats an undefined change like an absent key", () => {
    expect(applyClearableChanges(stored, { legalName: undefined })).toEqual(stored);
  });
});
