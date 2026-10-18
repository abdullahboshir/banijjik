import {
  MAX_VARIANTS_PER_OFFERING,
  VARIANT_STATUS,
  type KindDetails,
  type Money,
  type QuantityRule,
  type StockComponent,
  type UnitKey,
  type VariantOverrides,
} from "@banijjik/contracts/catalog";
import { newId } from "@banijjik/ids";
import { invalidFields, stockComponentsNeedInventory, type FieldProblem } from "./errors.js";
import { derivedVariantName, isActiveVariant, variantIdentityOf, type Variant } from "./variant.js";

/** A variant as the request describes it: optional fields are filled in here. */
export interface VariantDraft {
  readonly variantId?: string | undefined;
  readonly name?: string | undefined;
  readonly optionValues?: Readonly<Record<string, string>> | undefined;
  readonly price: Money;
  readonly compareAtPrice?: Money | undefined;
  readonly sku?: string | undefined;
  readonly barcode?: string | undefined;
  readonly unitKey: UnitKey;
  readonly quantityRule?: QuantityRule | undefined;
  readonly stockComponents?: readonly StockComponent[] | undefined;
  /** Already checked against the offering kind by the validation package. */
  readonly overrides?: VariantOverrides | undefined;
}

const CURRENCY_KEY = "errors.offering_currency_mismatch";
const UNKNOWN_VARIANT_KEY = "errors.offering_variant_unknown";
const DUPLICATE_OPTIONS_KEY = "errors.offering_variant_duplicate_options";
const TOO_MANY_KEY = "validation.too_big";
const SKU_REPEATED_KEY = "validation.invalid_value";

function variantFrom(draft: VariantDraft, variantId: string): Variant {
  const optionValues = draft.optionValues ?? {};
  return {
    variantId,
    name: draft.name ?? derivedVariantName(optionValues),
    optionValues,
    price: draft.price,
    compareAtPrice: draft.compareAtPrice,
    sku: draft.sku,
    barcode: draft.barcode,
    unitKey: draft.unitKey,
    quantityRule: draft.quantityRule,
    stockComponents: draft.stockComponents ?? [],
    overrides: draft.overrides ?? {},
    status: VARIANT_STATUS.ACTIVE,
  };
}

function currencyProblems(drafts: readonly VariantDraft[], currency: string): FieldProblem[] {
  const problems: FieldProblem[] = [];
  drafts.forEach((draft, index) => {
    if (draft.price.currency !== currency) {
      problems.push({ path: `variants.${index}.price.currency`, messageKey: CURRENCY_KEY });
    }
    if (draft.compareAtPrice !== undefined && draft.compareAtPrice.currency !== currency) {
      problems.push({
        path: `variants.${index}.compareAtPrice.currency`,
        messageKey: CURRENCY_KEY,
      });
    }
  });
  return problems;
}

function referenceProblems(
  drafts: readonly VariantDraft[],
  existingIds: ReadonlySet<string>,
): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const seen = new Set<string>();
  drafts.forEach((draft, index) => {
    if (draft.variantId === undefined) return;
    const isKnown = existingIds.has(draft.variantId) && !seen.has(draft.variantId);
    if (!isKnown)
      problems.push({ path: `variants.${index}.variantId`, messageKey: UNKNOWN_VARIANT_KEY });
    seen.add(draft.variantId);
  });
  return problems;
}

function skuProblems(variants: readonly Variant[]): FieldProblem[] {
  const seen = new Set<string>();
  const problems: FieldProblem[] = [];
  variants.forEach((variant, index) => {
    if (variant.sku === undefined) return;
    if (seen.has(variant.sku)) {
      problems.push({ path: `variants.${index}.sku`, messageKey: SKU_REPEATED_KEY });
    }
    seen.add(variant.sku);
  });
  return problems;
}

function optionProblems(
  active: readonly Variant[],
  drafts: readonly VariantDraft[],
): FieldProblem[] {
  const seen = new Set<string>();
  const problems: FieldProblem[] = [];
  active.forEach((variant, index) => {
    const identity = variantIdentityOf(variant);
    if (seen.has(identity.key)) {
      const draftIndex = drafts.findIndex((draft) => draft.variantId === variant.variantId);
      const path = `variants.${draftIndex >= 0 ? draftIndex : index}.${identity.path}`;
      problems.push({ path, messageKey: DUPLICATE_OPTIONS_KEY });
    }
    seen.add(identity.key);
  });
  return problems;
}

/**
 * The variant list after an edit, from the full list the request sent (ADR-116). A draft with a
 * known `variantId` keeps that id; one without gets a new id; an existing variant the request leaves
 * out is archived, never deleted, because orders and bookings point at its id. Rejects (400) an
 * unknown or repeated id, a foreign currency, repeated options or SKUs, and more than 100 variants
 * in total; rejects (422) any stock component until inventory items exist (card 3.3).
 */
export function mergeVariants(input: {
  readonly existing: readonly Variant[];
  readonly drafts: readonly VariantDraft[];
  readonly currency: string;
}): Variant[] {
  const { existing, drafts, currency } = input;
  const problems = [
    ...currencyProblems(drafts, currency),
    ...referenceProblems(drafts, new Set(existing.map((variant) => variant.variantId))),
  ];
  const active = drafts.map((draft) => variantFrom(draft, draft.variantId ?? newId()));
  const keptIds = new Set(active.map((variant) => variant.variantId));
  const archived = existing
    .filter((variant) => !keptIds.has(variant.variantId))
    .map((variant) => ({ ...variant, status: VARIANT_STATUS.ARCHIVED }));
  const merged = [...active, ...archived];
  problems.push(...optionProblems(active.filter(isActiveVariant), drafts), ...skuProblems(merged));
  if (merged.length > MAX_VARIANTS_PER_OFFERING) {
    problems.push({ path: "variants", messageKey: TOO_MANY_KEY });
  }
  if (problems.length > 0) throw invalidFields(problems);
  if (merged.some((variant) => variant.stockComponents.length > 0)) {
    throw stockComponentsNeedInventory();
  }
  return merged;
}

const MONEY_DETAIL_FIELDS = ["admissionFee", "securityDeposit", "depositAmount"] as const;

/** The money inside `kindDetails` (admission fee, deposits) must be in the organization's currency too. */
export function assertKindDetailsCurrency(details: KindDetails, currency: string): void {
  const record: Readonly<Record<string, unknown>> = { ...details };
  const wrong = MONEY_DETAIL_FIELDS.filter((field) => {
    const money = record[field] as Money | undefined;
    return money !== undefined && money.currency !== currency;
  });
  if (wrong.length === 0) return;
  throw invalidFields(
    wrong.map((field) => ({
      path: `kindDetails.${field}.currency`,
      messageKey: CURRENCY_KEY,
    })),
  );
}
