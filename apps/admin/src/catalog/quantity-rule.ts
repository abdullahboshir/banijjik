import {
  UNITS,
  UNIT_DIMENSION,
  UNIT_KEY,
  type QuantityRule,
  type UnitKey,
} from "@banijjik/contracts/catalog";

/** The unit people count a loose quantity in: kilograms are sold in grams (ADR-047, ADR-116). */
const LOOSE_COUNTING_UNIT: Partial<Record<UnitKey, UnitKey>> = {
  [UNIT_KEY.KG]: UNIT_KEY.GRAM,
  [UNIT_KEY.LITRE]: UNIT_KEY.ML,
  [UNIT_KEY.METRE]: UNIT_KEY.CM,
};
const LOOSE_DIMENSIONS: readonly string[] = [
  UNIT_DIMENSION.WEIGHT,
  UNIT_DIMENSION.VOLUME,
  UNIT_DIMENSION.LENGTH,
];
const BENGALI_ZERO = "০".charCodeAt(0);

/** True when goods in this unit can be sold loose, by a minimum and a step (weight, volume, length). */
export function canSellLoose(unitKey: UnitKey): boolean {
  return LOOSE_DIMENSIONS.includes(UNITS[unitKey].dimension);
}

/**
 * The unit the minimum and the step are typed in. A quantity is an integer of the sales unit
 * precision, so for KG the integer already counts grams and no multiplication is needed.
 */
export function looseCountingUnit(unitKey: UnitKey): UnitKey {
  return LOOSE_COUNTING_UNIT[unitKey] ?? unitKey;
}

export interface LooseRuleText {
  min: string;
  step: string;
}

function wholeNumber(text: string): number | undefined {
  const digits = text
    .trim()
    .replace(/[০-৯]/gu, (digit) => String(digit.charCodeAt(0) - BENGALI_ZERO));
  if (!/^\d+$/u.test(digits)) return undefined;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/** Builds the API rule from the two texts; `undefined` when a number is missing or min is below the step. */
export function quantityRuleFromText(text: LooseRuleText): QuantityRule | undefined {
  const min = wholeNumber(text.min);
  const step = wholeNumber(text.step);
  if (min === undefined || step === undefined || min < step) return undefined;
  return { min, step };
}

export function quantityRuleToText(rule: QuantityRule | null): LooseRuleText {
  return rule === null ? { min: "", step: "" } : { min: String(rule.min), step: String(rule.step) };
}
