import { describe, expect, it } from "vitest";
import { catalogListHref, offeringsApiPath, parseCatalogQuery } from "./catalog-query";

const SOME_ID = "0192a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b";

describe("parseCatalogQuery", () => {
  it("reads kind, status, category, location, search and page", () => {
    const query = parseCatalogQuery({
      kind: "SERVICE",
      status: "ARCHIVED",
      categoryId: SOME_ID,
      location: SOME_ID,
      q: "  hair ",
      page: "3",
    });

    expect(query).toEqual({
      kind: "SERVICE",
      status: "ARCHIVED",
      categoryId: SOME_ID,
      locationId: SOME_ID,
      q: "hair",
      page: 3,
    });
  });

  it("ignores values it cannot read instead of failing", () => {
    const query = parseCatalogQuery({ kind: "TOY", status: "x", categoryId: "no", page: "-2" });

    expect(query).toEqual({
      kind: undefined,
      status: undefined,
      categoryId: undefined,
      locationId: undefined,
      q: undefined,
      page: 1,
    });
  });
});

describe("catalogListHref and offeringsApiPath", () => {
  const base = parseCatalogQuery({});

  it("leaves defaults out of the address", () => {
    expect(catalogListHref("/shop/catalog", base)).toBe("/shop/catalog");
    expect(catalogListHref("/shop/catalog", { ...base, kind: "PRODUCT", page: 2 })).toBe(
      "/shop/catalog?kind=PRODUCT&page=2",
    );
  });

  it("asks the API for one limited page with the filters and the location", () => {
    const path = offeringsApiPath("org-1", { ...base, q: "rice", locationId: SOME_ID });

    expect(path).toBe(`/orgs/org-1/offerings?location=${SOME_ID}&q=rice&page=1&limit=20`);
  });
});
