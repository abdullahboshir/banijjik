import { describe, expect, it } from "vitest";
import { isSettingReadOnly, parseSettingText } from "./setting-input";

describe("parseSettingText", () => {
  it("accepts a boolean, an integer and a money amount in minor units", () => {
    expect(parseSettingText({ kind: "BOOLEAN" }, "true")).toBe(true);
    expect(parseSettingText({ kind: "BOOLEAN" }, "false")).toBe(false);
    expect(parseSettingText({ kind: "INTEGER", min: 0, max: 10 }, "3")).toBe(3);
    expect(parseSettingText({ kind: "INTEGER", min: 0, max: 10 }, "3.5")).toBeUndefined();
    expect(parseSettingText({ kind: "MONEY", min: 0, max: 100_000 }, "12.50")).toBe(1250);
    expect(parseSettingText({ kind: "DURATION_MINUTES", min: 0, max: 60 }, "15")).toBe(15);
  });

  it("accepts only the enum values and a text within its length", () => {
    const spec = { kind: "ENUM" as const, values: ["LATIN", "BENGALI"] };
    expect(parseSettingText(spec, "BENGALI")).toBe("BENGALI");
    expect(parseSettingText(spec, "ROMAN")).toBeUndefined();
    expect(parseSettingText({ kind: "TEXT", maxLength: 4 }, "shop")).toBe("shop");
    expect(parseSettingText({ kind: "TEXT", maxLength: 4 }, "shoppe")).toBeUndefined();
  });

  it("leaves a structured setting unread", () => {
    const spec = { kind: "STRUCTURED" as const, schemaKey: "hours" };
    expect(isSettingReadOnly(spec)).toBe(true);
    expect(parseSettingText(spec, "{}")).toBeUndefined();
    expect(isSettingReadOnly({ kind: "BOOLEAN" })).toBe(false);
  });
});
