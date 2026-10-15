import type { SettingValueSpec } from "@banijjik/contracts";
import { parseMoneyInput } from "@banijjik/ui";

/** The only platform currency is BDT, which has two fraction digits (ADR-013). */
const BDT_FRACTION_DIGITS = 2;

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

/**
 * Turns what the operator typed into a value the setting spec accepts.
 * `undefined` means the text is not a value of that spec.
 */
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
