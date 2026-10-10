import { describe, expect, it } from "vitest";
import { narrowLocations } from "./narrow-locations.js";

describe("narrowLocations", () => {
  it("keeps the granted locations when the caller has every location", () => {
    expect(narrowLocations("ALL", ["L1"])).toEqual(["L1"]);
  });

  it("keeps the caller's locations when the permission is granted everywhere", () => {
    expect(narrowLocations(["L1", "L2"], "ALL")).toEqual(["L1", "L2"]);
  });

  it("stays ALL when both are ALL", () => {
    expect(narrowLocations("ALL", "ALL")).toBe("ALL");
  });

  it("returns only the locations present in both lists", () => {
    expect(narrowLocations(["L1", "L2"], ["L2", "L3"])).toEqual(["L2"]);
  });

  it("can never add a location the caller did not have", () => {
    expect(narrowLocations(["L1"], ["L2"])).toEqual([]);
    expect(narrowLocations(["L1"], ["L1", "L2"])).toEqual(["L1"]);
  });

  it("gives nothing when the caller has no location context", () => {
    expect(narrowLocations(undefined, "ALL")).toEqual([]);
  });
});
