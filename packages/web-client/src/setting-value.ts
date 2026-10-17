import type { SettingValueSpec } from "@banijjik/contracts";
import { parseMoneyInput } from "@banijjik/ui";

/** Taka only at launch, two fraction digits (ADR-013). */
const BDT_FRACTION_DIGITS = 2;
const MINOR_UNITS_PER_MAJOR = 10 ** BDT_FRACTION_DIGITS;

/** STRUCTURED settings have no editor yet: none are registered, and the value is shown read-only. */
export function isSettingReadOnly(spec: SettingValueSpec): boolean {
  return spec.kind === "STRUCTURED";
}

function boundedInteger(text: string, min: number, max: number): number | undefined {
  if (!/^-?\d+$/u.test(text.trim())) return undefined;
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) return undefined;
  return value;
}

function boundedMoney(text: string, min: number, max: number): number | undefined {
  const parsed = parseMoneyInput(text, BDT_FRACTION_DIGITS);
  if (parsed === undefined || parsed.minorUnits < min || parsed.minorUnits > max) return undefined;
  return parsed.minorUnits;
}

function booleanText(text: string): boolean | undefined {
  if (text === "true") return true;
  if (text === "false") return false;
  return undefined;
}

/** What the person typed or chose, as a value the spec accepts. `undefined` means it is not one. */
export function parseSettingText(spec: SettingValueSpec, text: string): unknown | undefined {
  switch (spec.kind) {
    case "BOOLEAN":
      return booleanText(text);
    case "INTEGER":
    case "DURATION_MINUTES":
      return boundedInteger(text, spec.min, spec.max);
    case "MONEY":
      return boundedMoney(text, spec.min, spec.max);
    case "ENUM":
      return spec.values.includes(text) ? text : undefined;
    case "TEXT":
      return text.length <= spec.maxLength ? text : undefined;
    case "STRUCTURED":
      return undefined;
    default: {
      const unreachable: never = spec;
      return unreachable;
    }
  }
}

function moneyText(minorUnits: number): string {
  const major = Math.floor(minorUnits / MINOR_UNITS_PER_MAJOR);
  const minor = minorUnits % MINOR_UNITS_PER_MAJOR;
  if (minor === 0) return String(major);
  return `${major}.${String(minor).padStart(BDT_FRACTION_DIGITS, "0")}`;
}

/** The stored value as the text an input starts with. */
export function settingToText(spec: SettingValueSpec, value: unknown): string {
  if (spec.kind === "MONEY" && typeof value === "number") return moneyText(value);
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return "";
}
