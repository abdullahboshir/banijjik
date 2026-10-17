import type { SettingValueSpec } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { isSettingReadOnly, parseSettingText, settingToText } from "./setting-value.js";

const ENUM: SettingValueSpec = { kind: "ENUM", values: ["LATIN", "BENGALI"] };
const INTEGER: SettingValueSpec = { kind: "INTEGER", min: 1, max: 10 };
const MONEY: SettingValueSpec = { kind: "MONEY", min: 0, max: 100000 };

describe("parseSettingText", () => {
  it("accepts a listed enum value and refuses another", () => {
    expect(parseSettingText(ENUM, "BENGALI")).toBe("BENGALI");
    expect(parseSettingText(ENUM, "ARABIC")).toBeUndefined();
  });

  it("reads true and false for a boolean", () => {
    expect(parseSettingText({ kind: "BOOLEAN" }, "true")).toBe(true);
    expect(parseSettingText({ kind: "BOOLEAN" }, "false")).toBe(false);
    expect(parseSettingText({ kind: "BOOLEAN" }, "yes")).toBeUndefined();
  });

  it("keeps an integer inside its bounds", () => {
    expect(parseSettingText(INTEGER, " 5 ")).toBe(5);
    expect(parseSettingText(INTEGER, "11")).toBeUndefined();
    expect(parseSettingText(INTEGER, "1.5")).toBeUndefined();
  });

  it("turns taka into integer minor units and refuses a float", () => {
    expect(parseSettingText(MONEY, "12.50")).toBe(1250);
    expect(parseSettingText(MONEY, "12.505")).toBeUndefined();
  });

  it("limits a text and never parses a structured value", () => {
    expect(parseSettingText({ kind: "TEXT", maxLength: 3 }, "abcd")).toBeUndefined();
    expect(parseSettingText({ kind: "STRUCTURED", schemaKey: "x" }, "{}")).toBeUndefined();
    expect(isSettingReadOnly({ kind: "STRUCTURED", schemaKey: "x" })).toBe(true);
    expect(isSettingReadOnly(ENUM)).toBe(false);
  });
});

describe("parseSettingText: more kinds", () => {
  it("accepts a boolean, an integer and a money amount in minor units", () => {
    expect(parseSettingText({ kind: "BOOLEAN" }, "false")).toBe(false);
    expect(parseSettingText({ kind: "INTEGER", min: 0, max: 10 }, "3.5")).toBeUndefined();
    expect(parseSettingText({ kind: "MONEY", min: 0, max: 100_000 }, "12.50")).toBe(1250);
    expect(parseSettingText({ kind: "DURATION_MINUTES", min: 0, max: 60 }, "15")).toBe(15);
  });

  it("marks only a structured setting as read-only", () => {
    expect(isSettingReadOnly({ kind: "STRUCTURED", schemaKey: "hours" })).toBe(true);
    expect(isSettingReadOnly({ kind: "BOOLEAN" })).toBe(false);
  });
});

describe("settingToText", () => {
  it("shows minor units as taka with integer math", () => {
    expect(settingToText(MONEY, 1250)).toBe("12.50");
    expect(settingToText(MONEY, 1200)).toBe("12");
    expect(settingToText(MONEY, 5)).toBe("0.05");
  });

  it("shows other values as text", () => {
    expect(settingToText(ENUM, "LATIN")).toBe("LATIN");
    expect(settingToText({ kind: "BOOLEAN" }, true)).toBe("true");
    expect(settingToText(INTEGER, 7)).toBe("7");
  });
});
