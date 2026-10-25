import { describe, expect, it } from "vitest";
import { attemptFor } from "./attempt-key";

describe("checkout attempt key", () => {
  it("a retry of the same request keeps its key, so the sale is replayed and never charged twice", () => {
    const first = attemptFor(null, '{"lines":[1]}');
    const retry = attemptFor(first, '{"lines":[1]}');

    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
  });

  it("an edited tender gets a new key, so an earlier answer is not replayed for it", () => {
    const first = attemptFor(null, '{"payments":[{"amount":100}]}');
    const edited = attemptFor(first, '{"payments":[{"amount":200}]}');

    expect(edited.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(edited.bodyText).toBe('{"payments":[{"amount":200}]}');
  });
});
