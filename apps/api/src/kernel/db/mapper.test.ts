import { describe, expect, it } from "vitest";
import { stripMongoInternals } from "./mapper.js";

describe("stripMongoInternals", () => {
  it("removes _id and __v and keeps every other field", () => {
    const stored = { _id: "abc", __v: 3, orderId: "o1", nested: { a: 1 }, total: 5 };

    const domain = stripMongoInternals(stored);

    expect(domain).toEqual({ orderId: "o1", nested: { a: 1 }, total: 5 });
  });

  it("does not change the input object", () => {
    const stored = { _id: "abc", orderId: "o1" };

    stripMongoInternals(stored);

    expect(stored).toEqual({ _id: "abc", orderId: "o1" });
  });
});
