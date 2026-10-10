import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Rahim Uddin Ahmed")).toBe("RU");
  });

  it("keeps a Bangla letter together with its vowel sign", () => {
    expect(initialsOf("কিশোর আহমেদ")).toBe("কিআ");
  });

  it("handles a single word and extra spaces", () => {
    expect(initialsOf("  Karima  ")).toBe("K");
  });

  it("returns an empty string for an empty name", () => {
    expect(initialsOf("   ")).toBe("");
  });
});
