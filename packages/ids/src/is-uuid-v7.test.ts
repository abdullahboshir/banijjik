import { describe, expect, it } from "vitest";
import { asId, InvalidIdError } from "./branded-ids.js";
import { isUuidV7 } from "./is-uuid-v7.js";
import { newId } from "./new-id.js";

describe("isUuidV7", () => {
  it("accepts an ID made by newId", () => {
    expect(isUuidV7(newId())).toBe(true);
  });

  it.each([
    ["a v4 UUID", "3b241101-e2bb-4255-8caf-4136c566a962"],
    ["an uppercase v7", "01933E5A-7C2B-7ABC-8123-0123456789AB"],
    ["a missing hyphen", "01933e5a7c2b-7abc-8123-0123456789ab"],
    ["an empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(isUuidV7(value)).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(isUuidV7(42)).toBe(false);
  });
});

describe("asId", () => {
  it("returns the same string for a valid v7", () => {
    const value = newId();
    expect(asId(value)).toBe(value);
  });

  it("throws InvalidIdError for an invalid value", () => {
    expect(() => asId("not-an-id")).toThrow(InvalidIdError);
  });
});
