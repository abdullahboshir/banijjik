import { describe, expect, it } from "vitest";
import { listingQueryString, pageOf } from "./search-query";

describe("search query", () => {
  it("builds the API query from the filter fields and the page only", () => {
    const query = listingQueryString({
      page: "3",
      "f.gender": "female",
      "f.religion": ["islam", "other"],
      "f.age.ageMin": "25",
      "f.age.ageMax": "",
      sort: "name",
      utm: "x",
    });

    expect(query).toBe("page=3&f.gender=female&f.religion=islam&f.religion=other&f.age.ageMin=25");
  });

  it("treats anything but a positive whole page number as page one", () => {
    expect(pageOf({ page: "0" })).toBe(1);
    expect(pageOf({ page: "2.5" })).toBe(1);
    expect(pageOf({ page: "4" })).toBe(4);
    expect(pageOf({})).toBe(1);
  });
});
