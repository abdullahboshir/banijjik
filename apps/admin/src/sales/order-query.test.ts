import { describe, expect, it } from "vitest";
import {
  ORDERS_PAGE_SIZE,
  ordersApiQuery,
  ordersHref,
  parseOrdersQuery,
  statusHref,
} from "./order-query";

const LOCATION_ID = "01900000-0000-7000-8000-000000000001";

describe("parseOrdersQuery", () => {
  it("starts at page one with no filters", () => {
    expect(parseOrdersQuery({})).toEqual({
      locationId: undefined,
      status: undefined,
      q: undefined,
      page: 1,
    });
  });

  it("keeps a valid location, status and trimmed search term", () => {
    expect(
      parseOrdersQuery({
        location: LOCATION_ID,
        status: "PLACED",
        q: "  000012  ",
        page: "3",
      }),
    ).toEqual({ locationId: LOCATION_ID, status: "PLACED", q: "000012", page: 3 });
  });

  it("takes the first value when the URL repeats a parameter", () => {
    expect(parseOrdersQuery({ status: ["CONFIRMED", "CANCELLED"], q: ["rice", "lentil"] })).toEqual(
      { locationId: undefined, status: "CONFIRMED", q: "rice", page: 1 },
    );
  });

  it("drops a location that is not a UUID and a status outside the enum", () => {
    const query = parseOrdersQuery({ location: "acme", status: "SHIPPING" });
    expect(query.locationId).toBeUndefined();
    expect(query.status).toBeUndefined();
  });

  it("falls back to page one for a page that is not a positive whole number", () => {
    expect(parseOrdersQuery({ page: "0" }).page).toBe(1);
    expect(parseOrdersQuery({ page: "-2" }).page).toBe(1);
    expect(parseOrdersQuery({ page: "two" }).page).toBe(1);
  });
});

describe("ordersHref", () => {
  it("is the plain path when nothing is filtered", () => {
    expect(
      ordersHref("/acme/orders", {
        locationId: undefined,
        status: undefined,
        q: undefined,
        page: 1,
      }),
    ).toBe("/acme/orders");
  });

  it("keeps the filters and leaves page one out of the URL", () => {
    expect(
      ordersHref("/acme/orders", {
        locationId: LOCATION_ID,
        status: "DRAFT",
        q: "shirt",
        page: 1,
      }),
    ).toBe(`/acme/orders?location=${LOCATION_ID}&status=DRAFT&q=shirt`);
  });

  it("adds the page when it is past the first", () => {
    expect(
      ordersHref("/acme/orders", {
        locationId: undefined,
        status: undefined,
        q: undefined,
        page: 2,
      }),
    ).toBe("/acme/orders?page=2");
  });
});

describe("ordersApiQuery", () => {
  it("asks the API with the filter names it expects and this screen's page size", () => {
    const query = ordersApiQuery({
      locationId: LOCATION_ID,
      status: "PLACED",
      q: "rice",
      page: 2,
    });
    expect(query).toBe(
      `locationId=${LOCATION_ID}&status=PLACED&q=rice&page=2&limit=${String(ORDERS_PAGE_SIZE)}`,
    );
  });

  it("always sends a page and a limit", () => {
    const params = new URLSearchParams(
      ordersApiQuery({ locationId: undefined, status: undefined, q: undefined, page: 1 }),
    );
    expect(params.get("page")).toBe("1");
    expect(params.get("limit")).toBe("20");
  });
});

describe("statusHref", () => {
  it("keeps the location and search term and starts again at page one", () => {
    expect(
      statusHref(
        "/acme/orders",
        { locationId: LOCATION_ID, status: "PLACED", q: "rice", page: 4 },
        "CONFIRMED",
      ),
    ).toBe(`/acme/orders?location=${LOCATION_ID}&status=CONFIRMED&q=rice`);
  });

  it("removes the status when all statuses are chosen", () => {
    expect(
      statusHref(
        "/acme/orders",
        { locationId: undefined, status: "PLACED", q: undefined, page: 1 },
        undefined,
      ),
    ).toBe("/acme/orders");
  });
});
