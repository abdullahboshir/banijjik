import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildSettingValueSchema } from "./build-setting-value-schema.js";

const ZONE_SCHEMA = z.object({ name: z.string() }).strict();

describe("buildSettingValueSchema", () => {
  it("accepts a boolean and refuses anything else", () => {
    const schema = buildSettingValueSchema({ kind: "BOOLEAN" });

    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse(false).success).toBe(true);
    expect(schema.safeParse("true").success).toBe(false);
  });

  it("accepts an integer inside the bounds and refuses a float and a value outside them", () => {
    const schema = buildSettingValueSchema({ kind: "INTEGER", min: 0, max: 10 });

    expect(schema.safeParse(0).success).toBe(true);
    expect(schema.safeParse(10).success).toBe(true);
    expect(schema.safeParse(1.5).success).toBe(false);
    expect(schema.safeParse(11).success).toBe(false);
  });

  it("refuses a float for MONEY, which is integer minor units", () => {
    const schema = buildSettingValueSchema({ kind: "MONEY", min: 0, max: 100_000 });

    expect(schema.safeParse(2500).success).toBe(true);
    expect(schema.safeParse(25.5).success).toBe(false);
  });

  it("accepts a duration in whole minutes inside the bounds", () => {
    const schema = buildSettingValueSchema({ kind: "DURATION_MINUTES", min: 5, max: 60 });

    expect(schema.safeParse(15).success).toBe(true);
    expect(schema.safeParse(15.5).success).toBe(false);
    expect(schema.safeParse(4).success).toBe(false);
  });

  it("accepts an enum value and refuses an unknown one", () => {
    const schema = buildSettingValueSchema({ kind: "ENUM", values: ["LATIN", "BENGALI"] });

    expect(schema.safeParse("BENGALI").success).toBe(true);
    expect(schema.safeParse("ARABIC").success).toBe(false);
  });

  it("accepts text up to the max length and refuses a longer string", () => {
    const schema = buildSettingValueSchema({ kind: "TEXT", maxLength: 4 });

    expect(schema.safeParse("cafe").success).toBe(true);
    expect(schema.safeParse("cafes").success).toBe(false);
  });

  it("checks a STRUCTURED value with the schema registered for its key", () => {
    const schema = buildSettingValueSchema(
      { kind: "STRUCTURED", schemaKey: "delivery.zones" },
      { "delivery.zones": ZONE_SCHEMA },
    );

    expect(schema.safeParse({ name: "Dhaka" }).success).toBe(true);
    expect(schema.safeParse({ name: 1 }).success).toBe(false);
  });

  it("refuses every STRUCTURED value when the schema key is not registered", () => {
    const schema = buildSettingValueSchema({ kind: "STRUCTURED", schemaKey: "delivery.zones" });

    expect(schema.safeParse({ name: "Dhaka" }).success).toBe(false);
  });
});
