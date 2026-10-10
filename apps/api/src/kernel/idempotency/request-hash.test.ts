import { describe, expect, it } from "vitest";
import { canonicalJson, computeRequestHash } from "./request-hash.js";

const baseRequest = {
  method: "POST",
  routePattern: "/api/v1/me/orgs",
  params: {},
  body: { name: "Rahim Store", nested: { first: 1, second: [3, 2, 1] } },
};

describe("canonicalJson", () => {
  it("sorts object keys at every depth and keeps array order", () => {
    const shuffled = { nested: { second: [3, 2, 1], first: 1 }, name: "Rahim Store" };

    expect(canonicalJson(shuffled)).toBe(canonicalJson(baseRequest.body));
    expect(canonicalJson({ list: [2, 1] })).not.toBe(canonicalJson({ list: [1, 2] }));
  });

  it("treats a missing body like null", () => {
    expect(canonicalJson(undefined)).toBe("null");
  });
});

describe("computeRequestHash", () => {
  it("ignores the order of keys in the body", () => {
    const reordered = {
      ...baseRequest,
      body: { nested: { second: [3, 2, 1], first: 1 }, name: "Rahim Store" },
    };

    expect(computeRequestHash(reordered)).toBe(computeRequestHash(baseRequest));
  });

  it("changes with the route pattern and the method", () => {
    const otherRoute = { ...baseRequest, routePattern: "/api/v1/me/other" };
    const otherMethod = { ...baseRequest, method: "PATCH" };

    expect(computeRequestHash(otherRoute)).not.toBe(computeRequestHash(baseRequest));
    expect(computeRequestHash(otherMethod)).not.toBe(computeRequestHash(baseRequest));
  });

  it("changes with a path parameter, so one key cannot act on two records", () => {
    const first = { ...baseRequest, params: { roleId: "role-1" } };
    const second = { ...baseRequest, params: { roleId: "role-2" } };

    expect(computeRequestHash(first)).not.toBe(computeRequestHash(second));
  });

  it("changes with any value of the body", () => {
    const changed = { ...baseRequest, body: { ...baseRequest.body, name: "Karim Store" } };

    expect(computeRequestHash(changed)).not.toBe(computeRequestHash(baseRequest));
  });
});
