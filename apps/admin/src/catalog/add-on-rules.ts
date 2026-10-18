import { MODIFIER_SELECTION, type ModifierSelection } from "@banijjik/contracts/catalog";

export interface AddOnRules {
  selection: ModifierSelection;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
}

/**
 * Makes the four settings agree the way the API wants them (a required group asks for at least one,
 * a single choice allows exactly one, the most never passes the number of options). The person edits
 * the plain words; the numbers follow.
 */
export function normalizeRules(rules: AddOnRules, optionCount: number): AddOnRules {
  const ceiling = Math.max(1, optionCount);
  if (rules.selection === MODIFIER_SELECTION.SINGLE) {
    return { ...rules, minSelect: rules.isRequired ? 1 : 0, maxSelect: 1 };
  }
  const maxSelect = Math.min(Math.max(1, rules.maxSelect), ceiling);
  const wantedMin = rules.isRequired ? Math.max(1, rules.minSelect) : 0;
  return { ...rules, minSelect: Math.min(wantedMin, maxSelect), maxSelect };
}

export interface RuleSentence {
  /** The label key (after `catalog.addOns.rule.`) and its values. */
  key: "single" | "singleOptional" | "multipleRequired" | "multipleOptional";
  values: { min: number; max: number };
}

/** Which plain sentence explains the rules, so the owner sees what customers will experience. */
export function describeRules(rules: AddOnRules): RuleSentence {
  const values = { min: rules.minSelect, max: rules.maxSelect };
  if (rules.selection === MODIFIER_SELECTION.SINGLE) {
    return { key: rules.isRequired ? "single" : "singleOptional", values };
  }
  return { key: rules.isRequired ? "multipleRequired" : "multipleOptional", values };
}
