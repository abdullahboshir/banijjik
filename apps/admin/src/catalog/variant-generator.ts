import {
  MAX_OPTION_NAMES_PER_VARIANT,
  MAX_VARIANTS_PER_OFFERING,
} from "@banijjik/contracts/catalog";

export interface OptionDraft {
  name: string;
  values: readonly string[];
}

export type OptionValues = Readonly<Record<string, string>>;

/** The parts of a row the generator needs; the form keeps price, SKU and the rest on the same row. */
export interface VariantRowKey {
  variantId?: string | undefined;
  optionValues: OptionValues;
}

export interface GeneratedRows<Row> {
  rows: Row[];
  /** True when the options allow more combinations than one offering may have. */
  isCapped: boolean;
}

const NAME_SEPARATOR = " / ";

/** Trims names and values, drops empty and repeated ones, keeps at most three option names. */
export function cleanOptions(options: readonly OptionDraft[]): OptionDraft[] {
  const cleaned: OptionDraft[] = [];
  for (const option of options) {
    const name = option.name.trim();
    const values = [...new Set(option.values.map((value) => value.trim()).filter(Boolean))];
    if (name === "" || values.length === 0) continue;
    if (cleaned.some((kept) => kept.name === name)) continue;
    cleaned.push({ name, values });
  }
  return cleaned.slice(0, MAX_OPTION_NAMES_PER_VARIANT);
}

/** Every existing combination extended by each value of one more option, stopping just past the limit. */
function extendCombinations(
  combinations: readonly Record<string, string>[],
  option: OptionDraft,
  limit: number,
): Record<string, string>[] {
  const next = combinations.flatMap((combination) =>
    option.values.map((value) => ({ ...combination, [option.name]: value })),
  );
  return next.slice(0, limit + 1);
}

function combinationsOf(options: readonly OptionDraft[], limit: number): OptionValues[] {
  let combinations: Record<string, string>[] = [{}];
  for (const option of options) combinations = extendCombinations(combinations, option, limit);
  return combinations;
}

export function sameOptionValues(left: OptionValues, right: OptionValues): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}

/** "Small / Red": the variant name shown to the customer, built from the option values in option order. */
export function variantNameOf(optionValues: OptionValues): string {
  return Object.values(optionValues).join(NAME_SEPARATOR);
}

/**
 * Expands the options into one row per combination (13-UX 4.1a). A row that already exists with the same
 * values is kept as it is, so its id, price and SKU survive an edit of the options (ADR-098); the
 * rows that no longer match are simply left out and the API archives them. The list stops at 100.
 */
export function generateRows<Row extends VariantRowKey>(
  options: readonly OptionDraft[],
  existingRows: readonly Row[],
  createRow: (optionValues: OptionValues) => Row,
): GeneratedRows<Row> {
  const combinations = combinationsOf(cleanOptions(options), MAX_VARIANTS_PER_OFFERING);
  const isCapped = combinations.length > MAX_VARIANTS_PER_OFFERING;
  const rows = combinations
    .slice(0, MAX_VARIANTS_PER_OFFERING)
    .map(
      (optionValues) =>
        existingRows.find((row) => sameOptionValues(row.optionValues, optionValues)) ??
        createRow(optionValues),
    );
  return { rows, isCapped };
}

/** The option names and values an existing offering already uses, rebuilt from its variants. */
export function optionsOfRows(rows: readonly VariantRowKey[]): OptionDraft[] {
  const byName = new Map<string, string[]>();
  for (const row of rows) {
    for (const [name, value] of Object.entries(row.optionValues)) {
      const values = byName.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      byName.set(name, values);
    }
  }
  return [...byName].map(([name, values]) => ({ name, values }));
}
