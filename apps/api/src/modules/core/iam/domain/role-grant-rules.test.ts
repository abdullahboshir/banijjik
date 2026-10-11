import { describe, expect, it } from "vitest";
import { changedPermissionKeys, keysNotHeld } from "./role-grant-rules.js";

describe("changedPermissionKeys", () => {
  it("lists what is added and what is removed, and leaves out what stays", () => {
    expect(changedPermissionKeys(["a", "b"], ["b", "c"])).toEqual(["c", "a"]);
  });

  it("is empty when the set does not change, whatever the order", () => {
    expect(changedPermissionKeys(["a", "b"], ["b", "a"])).toEqual([]);
  });

  it("treats every key of a new role as added", () => {
    expect(changedPermissionKeys([], ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("keysNotHeld", () => {
  it("returns the keys the caller does not hold, sorted", () => {
    expect(keysNotHeld(["z", "a", "m"], ["m"])).toEqual(["a", "z"]);
  });

  it("returns nothing when the caller holds every key", () => {
    expect(keysNotHeld(["a"], ["a", "b"])).toEqual([]);
  });
});
