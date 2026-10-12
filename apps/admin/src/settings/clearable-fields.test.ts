import { describe, expect, it } from "vitest";
import { addressToText } from "./address-fields";
import { clearableAddress, clearableText } from "./clearable-fields";

describe("clearableText", () => {
  it("sends the trimmed text when the field has a value", () => {
    expect(clearableText(" Rahim Ltd ", "")).toBe("Rahim Ltd");
    expect(clearableText("New", "Old")).toBe("New");
  });

  it("sends null when a field that was filled is now empty", () => {
    expect(clearableText("", "Rahim Ltd")).toBeNull();
    expect(clearableText("   ", "Rahim Ltd")).toBeNull();
  });

  it("sends nothing when the field was empty and still is", () => {
    expect(clearableText("", "")).toBeUndefined();
    expect(clearableText("  ", "  ")).toBeUndefined();
  });
});

describe("clearableAddress", () => {
  const filled = addressToText({ line1: "12 Park Road", district: "Dhaka" });
  const empty = addressToText(undefined);

  it("sends the filled parts as one address", () => {
    expect(clearableAddress({ ...empty, line1: "12 Park Road" }, empty)).toEqual({
      line1: "12 Park Road",
    });
  });

  it("sends the address without the part that was emptied, because the address is replaced as a whole", () => {
    expect(clearableAddress({ ...filled, district: "" }, filled)).toEqual({
      line1: "12 Park Road",
    });
  });

  it("sends null when an address that had parts is now empty in every part", () => {
    expect(clearableAddress(empty, filled)).toBeNull();
  });

  it("sends nothing when there was no address and none was typed", () => {
    expect(clearableAddress(empty, empty)).toBeUndefined();
  });
});
