import { describe, expect, it } from "vitest";
import { canSubmitReject, toggleReasonKey } from "./reject-form-state";

describe("reject form state", () => {
  it("requires at least one reason", () => {
    expect(canSubmitReject([])).toBe(false);
    expect(canSubmitReject(["unclear"])).toBe(true);
  });

  it("toggles reason keys without duplicates", () => {
    expect(toggleReasonKey([], "a")).toEqual(["a"]);
    expect(toggleReasonKey(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleReasonKey(["a", "b"], "a")).toEqual(["b"]);
  });
});
