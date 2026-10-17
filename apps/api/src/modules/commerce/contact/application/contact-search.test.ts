import { describe, expect, it } from "vitest";
import { buildContactSearch } from "./contact-search.js";

describe("buildContactSearch", () => {
  it.each(["017123", "01712 3", "+88017123", "880 17123", "17123"])(
    "reads %s as a prefix of the same stored Bangladesh number",
    (typed) => {
      expect(buildContactSearch(typed).phonePrefix).toBe("+88017123");
    },
  );

  it("does not treat a name as a phone", () => {
    expect(buildContactSearch("Rahim").phonePrefix).toBeUndefined();
    expect(buildContactSearch("Rahim").namePrefix).toBe("rahim");
  });

  it("does not treat two digits as a phone", () => {
    expect(buildContactSearch("01").phonePrefix).toBeUndefined();
  });
});
