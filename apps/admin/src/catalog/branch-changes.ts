import type { Money, OfferingLocationResponse } from "@banijjik/contracts/catalog";
import { moneyFromInput, moneyToInputText } from "@banijjik/web-client";

/** What the branch section shows for one variant at the chosen location. */
export interface BranchVariantState {
  variantId: string;
  isAvailable: boolean;
  /** The branch price as typed; empty means the normal price. */
  priceText: string;
}

export interface BranchState {
  isAvailable: boolean;
  variants: BranchVariantState[];
}

export type BranchOperation =
  | { type: "save"; variantId?: string; isAvailable: boolean; priceOverride?: Money }
  | { type: "clear"; variantId?: string };

export type BranchPlan =
  { ok: true; operations: BranchOperation[] } | { ok: false; invalidVariantIds: string[] };

/** The state of the section from the rows the API holds; no row means the organization defaults. */
export function branchStateOf(
  rows: readonly OfferingLocationResponse[],
  variantIds: readonly string[],
): BranchState {
  const wide = rows.find((row) => row.variantId === null);
  return {
    isAvailable: wide?.isAvailable ?? true,
    variants: variantIds.map((variantId) => {
      const row = rows.find((candidate) => candidate.variantId === variantId);
      return {
        variantId,
        isAvailable: row?.isAvailable ?? true,
        priceText: row?.priceOverride ? moneyToInputText(row.priceOverride) : "",
      };
    }),
  };
}

function hasRow(rows: readonly OfferingLocationResponse[], variantId: string | null): boolean {
  return rows.some((row) => row.variantId === variantId);
}

function wideOperation(
  state: BranchState,
  rows: readonly OfferingLocationResponse[],
): BranchOperation | undefined {
  if (!state.isAvailable) return { type: "save", isAvailable: false };
  return hasRow(rows, null) ? { type: "clear" } : undefined;
}

function variantOperation(
  variant: BranchVariantState,
  rows: readonly OfferingLocationResponse[],
  priceOverride: Money | undefined,
): BranchOperation | undefined {
  const isDefault = variant.isAvailable && priceOverride === undefined;
  if (isDefault) {
    return hasRow(rows, variant.variantId)
      ? { type: "clear", variantId: variant.variantId }
      : undefined;
  }
  return {
    type: "save",
    variantId: variant.variantId,
    isAvailable: variant.isAvailable,
    ...(priceOverride ? { priceOverride } : {}),
  };
}

/**
 * What to send so the API ends up as the section shows it: a row for every difference from the
 * defaults, and the removal of rows that went back to the defaults. A price that cannot be read
 * names its variant and nothing is sent.
 */
export function planBranchChanges(input: {
  state: BranchState;
  rows: readonly OfferingLocationResponse[];
  currency: Money["currency"];
}): BranchPlan {
  const { state, rows, currency } = input;
  const operations: BranchOperation[] = [];
  const invalidVariantIds: string[] = [];
  const wide = wideOperation(state, rows);
  if (wide) operations.push(wide);
  for (const variant of state.variants) {
    const priceOverride =
      variant.priceText.trim() === "" ? undefined : moneyFromInput(variant.priceText, currency);
    if (variant.priceText.trim() !== "" && priceOverride === undefined) {
      invalidVariantIds.push(variant.variantId);
      continue;
    }
    const operation = variantOperation(variant, rows, priceOverride);
    if (operation) operations.push(operation);
  }
  return invalidVariantIds.length > 0 ? { ok: false, invalidVariantIds } : { ok: true, operations };
}
