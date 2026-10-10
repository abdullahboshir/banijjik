import { describe, expect, it } from "vitest";
import { buildGrantMap, locationsGranting } from "./grant-map.js";

const GRANTS: Record<string, string[]> = {
  reader: ["iam.role.read"],
  writer: ["iam.role.create", "iam.role.read"],
  nothing: [],
};

function grantsOf(roleId: string): ReadonlySet<string> {
  return new Set(GRANTS[roleId] ?? []);
}

describe("buildGrantMap and locationsGranting", () => {
  it("answers ALL when a role assigned at ALL grants the key", () => {
    const map = buildGrantMap([{ locationId: "ALL", roleId: "reader" }], grantsOf);

    expect(locationsGranting(map, "iam.role.read")).toBe("ALL");
    expect(locationsGranting(map, "iam.role.create")).toEqual([]);
  });

  it("lists only the locations whose roles grant the key", () => {
    const map = buildGrantMap(
      [
        { locationId: "L1", roleId: "writer" },
        { locationId: "L2", roleId: "reader" },
        { locationId: "L3", roleId: "nothing" },
      ],
      grantsOf,
    );

    expect(locationsGranting(map, "iam.role.create")).toEqual(["L1"]);
    expect(locationsGranting(map, "iam.role.read")).toEqual(["L1", "L2"]);
  });

  it("answers an empty list when no role grants the key anywhere", () => {
    const map = buildGrantMap([{ locationId: "L1", roleId: "nothing" }], grantsOf);

    expect(locationsGranting(map, "iam.role.read")).toEqual([]);
  });

  it("unions the roles of a location and treats an unknown role as granting nothing", () => {
    const map = buildGrantMap(
      [
        { locationId: "L1", roleId: "reader" },
        { locationId: "L1", roleId: "writer" },
        { locationId: "L1", roleId: "deleted-role" },
      ],
      grantsOf,
    );

    expect([...(map.byLocation.get("L1") ?? [])].sort()).toEqual([
      "iam.role.create",
      "iam.role.read",
    ]);
  });
});
