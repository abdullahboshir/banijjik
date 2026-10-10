import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { paginationQuerySchema } from "../pagination.js";
import {
  roleArchiveRequestSchema,
  roleCreateRequestSchema,
  roleIdParamsSchema,
  roleUpdateRequestSchema,
} from "./role-schemas.js";

describe("roleCreateRequestSchema", () => {
  it("trims the name and collapses repeated permission keys", () => {
    const parsed = roleCreateRequestSchema.parse({
      name: "  Shift lead ",
      permissionKeys: ["iam.role.read", "iam.role.read"],
    });

    expect(parsed).toEqual({ name: "Shift lead", permissionKeys: ["iam.role.read"] });
  });

  it("rejects a permission key that is not in the catalogue", () => {
    const result = roleCreateRequestSchema.safeParse({
      name: "Shift lead",
      permissionKeys: ["platform.tenant.read"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too short", () => {
    const result = roleCreateRequestSchema.safeParse({ name: "A", permissionKeys: [] });

    expect(result.error?.issues[0]?.code).toBe("too_small");
  });

  it("rejects a field it does not know, such as isSystem", () => {
    const result = roleCreateRequestSchema.safeParse({
      name: "Shift lead",
      permissionKeys: [],
      isSystem: true,
    });

    expect(result.error?.issues[0]?.code).toBe("unrecognized_keys");
  });
});

describe("roleUpdateRequestSchema", () => {
  it("requires the version", () => {
    const result = roleUpdateRequestSchema.safeParse({ name: "Shift lead" });

    expect(result.success).toBe(false);
  });

  it("requires at least one change", () => {
    const result = roleUpdateRequestSchema.safeParse({ version: 1 });

    expect(result.success).toBe(false);
  });

  it("accepts a rename alone", () => {
    const result = roleUpdateRequestSchema.safeParse({ name: "Shift lead", version: 2 });

    expect(result.success).toBe(true);
  });
});

describe("roleArchiveRequestSchema and roleIdParamsSchema", () => {
  it("requires a version", () => {
    expect(roleArchiveRequestSchema.safeParse({}).success).toBe(false);
    expect(roleArchiveRequestSchema.safeParse({ version: 3 }).success).toBe(true);
  });

  it("accepts a UUID v7 role id only", () => {
    expect(roleIdParamsSchema.safeParse({ roleId: newId() }).success).toBe(true);
    expect(roleIdParamsSchema.safeParse({ roleId: "nope" }).success).toBe(false);
  });
});

describe("paginationQuerySchema", () => {
  it("defaults to the first page of 20", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it("reads numbers from query strings", () => {
    expect(paginationQuerySchema.parse({ page: "2", limit: "50" })).toEqual({ page: 2, limit: 50 });
  });

  it("refuses a limit above 100", () => {
    expect(paginationQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});
