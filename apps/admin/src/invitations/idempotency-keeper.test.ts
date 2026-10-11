import { describe, expect, it } from "vitest";
import { keyForSubmit } from "./idempotency-keeper";

let issued = 0;
const makeKey = (): string => `key-${(issued += 1)}`;

describe("keyForSubmit", () => {
  it("gives a first submit a new key", () => {
    expect(keyForSubmit(undefined, "body-a", makeKey)).toEqual({
      key: expect.stringMatching(/^key-/),
      fingerprint: "body-a",
    });
  });

  it("reuses the key when the same body is sent again after a failure", () => {
    const first = keyForSubmit(undefined, "body-a", makeKey);
    expect(keyForSubmit(first, "body-a", makeKey).key).toBe(first.key);
  });

  it("changes the key when the body changed, and after a success forgot the previous submit", () => {
    const first = keyForSubmit(undefined, "body-a", makeKey);
    expect(keyForSubmit(first, "body-b", makeKey).key).not.toBe(first.key);
    expect(keyForSubmit(undefined, "body-a", makeKey).key).not.toBe(first.key);
  });
});
