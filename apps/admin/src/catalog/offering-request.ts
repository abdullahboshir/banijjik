import { OFFERING_KIND } from "@banijjik/contracts";
import {
  PLAN_START_RULE,
  type Money,
  type QuantityRule,
  type StockComponent,
  type UnitKey,
} from "@banijjik/contracts/catalog";
import { moneyFromInput } from "@banijjik/web-client";
import type { FieldErrors } from "../auth/field-errors";
import {
  overrideFieldOf,
  type DetailsState,
  type OfferingFormState,
  type VariantRow,
} from "./offering-form";
import { canSellLoose, quantityRuleFromText } from "./quantity-rule";
import { cleanOptions, variantNameOf } from "./variant-generator";

export const REQUIRED_KEY = "validation.required";
export const INVALID_KEY = "validation.invalid_format";

export interface VariantPayload {
  variantId?: string;
  name?: string;
  optionValues?: Record<string, string>;
  price: Money;
  compareAtPrice?: Money;
  sku?: string;
  barcode?: string;
  unitKey: UnitKey;
  quantityRule?: QuantityRule;
  overrides?: Record<string, unknown>;
  stockComponents?: StockComponent[];
}

/** What the form sends. A create adds `kind`; an update adds `version` and sends `null` to clear the description. */
export interface OfferingPayload {
  name: string;
  description: string | null;
  categoryIds: string[];
  modifierGroupIds: string[];
  imageFileIds: string[];
  /** `null` clears a stored class so the business default applies. */
  taxClassKey: string | null;
  kindDetails: Record<string, unknown>;
  variants: VariantPayload[];
}

export type BuildResult<Body> = { ok: true; body: Body } | { ok: false; errors: FieldErrors };

export function wholeNumberOf(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/u.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** An optional whole number: empty is fine and means "not set", anything else must be a number above zero. */
function optionalPositive(text: string, field: string, errors: FieldErrors): number | undefined {
  if (text.trim() === "") return undefined;
  const value = wholeNumberOf(text);
  if (value === undefined || value < 1) errors[field] = INVALID_KEY;
  return value;
}

function requiredPositive(text: string, field: string, errors: FieldErrors): number {
  if (text.trim() === "") errors[field] = REQUIRED_KEY;
  else if ((wholeNumberOf(text) ?? 0) < 1) errors[field] = INVALID_KEY;
  return wholeNumberOf(text) ?? 0;
}

interface MoneyContext {
  currency: Money["currency"];
  errors: FieldErrors;
}

function optionalMoney(text: string, field: string, context: MoneyContext): Money | undefined {
  if (text.trim() === "") return undefined;
  const money = moneyFromInput(text, context.currency);
  if (money === undefined) context.errors[field] = INVALID_KEY;
  return money;
}

function requiredMoney(text: string, field: string, context: MoneyContext): Money {
  const money = optionalMoney(text, field, context);
  if (text.trim() === "") context.errors[field] = REQUIRED_KEY;
  return money ?? { amount: 0, currency: context.currency };
}

function productDetails(details: DetailsState, errors: FieldErrors): Record<string, unknown> {
  const weightGrams = optionalPositive(details.weightGrams, "weightGrams", errors);
  return {
    requiresShipping: details.requiresShipping,
    ...(weightGrams === undefined ? {} : { weightGrams }),
  };
}

function serviceDetails(details: DetailsState, errors: FieldErrors): Record<string, unknown> {
  const buffer = wholeNumberOf(details.bufferAfterMinutes);
  if (buffer === undefined) errors["bufferAfterMinutes"] = INVALID_KEY;
  return {
    durationMinutes: requiredPositive(details.durationMinutes, "durationMinutes", errors),
    bufferAfterMinutes: buffer ?? 0,
    bookingMode: details.bookingMode,
  };
}

function startDatesOf(text: string): string[] {
  return text
    .split(/[\s,]+/u)
    .map((date) => date.trim())
    .filter(Boolean);
}

function planDetails(
  details: DetailsState,
  currency: Money["currency"],
  errors: FieldErrors,
): Record<string, unknown> {
  const admissionFee = optionalMoney(details.admissionFee, "admissionFee", { currency, errors });
  const capacity = optionalPositive(details.capacity, "capacity", errors);
  const sessionLimit = optionalPositive(
    details.sessionLimitPerPeriod,
    "sessionLimitPerPeriod",
    errors,
  );
  const dates = startDatesOf(details.startDates);
  const isFixed = details.startRule === PLAN_START_RULE.FIXED_DATES;
  if (isFixed && dates.length === 0) errors["startDates"] = REQUIRED_KEY;
  return {
    billingPeriod: {
      unit: details.billingUnit,
      count: requiredPositive(details.billingCount, "billingCount", errors),
    },
    startRule: details.startRule,
    ...(isFixed ? { startDates: dates } : {}),
    ...(admissionFee ? { admissionFee } : {}),
    ...(capacity === undefined ? {} : { capacity }),
    ...(sessionLimit === undefined ? {} : { sessionLimitPerPeriod: sessionLimit }),
  };
}

function kindDetailsOf(
  state: OfferingFormState,
  currency: Money["currency"],
  errors: FieldErrors,
): Record<string, unknown> {
  if (state.kind === OFFERING_KIND.PRODUCT) return productDetails(state.details, errors);
  if (state.kind === OFFERING_KIND.SERVICE) return serviceDetails(state.details, errors);
  if (state.kind === OFFERING_KIND.PLAN) return planDetails(state.details, currency, errors);
  return {};
}

function overridesOf(
  state: OfferingFormState,
  row: VariantRow,
  errors: FieldErrors,
): Record<string, unknown> | undefined {
  const field = overrideFieldOf(state.kind);
  if (field === undefined || row.override.trim() === "") return undefined;
  const value = optionalPositive(row.override, "variants", errors);
  if (value === undefined) return undefined;
  if (field === "durationMinutes") return { durationMinutes: value };
  if (field === "weightGrams") return { weightGrams: value };
  return { billingPeriod: { unit: state.details.billingUnit, count: value } };
}

function stockComponentsOf(
  state: OfferingFormState,
  row: VariantRow,
  errors: FieldErrors,
): StockComponent[] | undefined {
  if (state.kind !== OFFERING_KIND.PRODUCT || row.stockComponents.length === 0) return undefined;
  const components: StockComponent[] = [];
  row.stockComponents.forEach((component, index) => {
    const prefix = `stock-${index}`;
    const quantity = wholeNumberOf(component.quantity);
    if (component.inventoryItemId.trim() === "") errors[prefix] = REQUIRED_KEY;
    if (quantity === undefined || quantity < 1) errors[prefix] = INVALID_KEY;
    if (component.inventoryItemId.trim() !== "" && quantity !== undefined && quantity >= 1) {
      components.push({ inventoryItemId: component.inventoryItemId.trim(), quantity });
    }
  });
  return components.length > 0 ? components : undefined;
}

function ruleOf(state: OfferingFormState, errors: FieldErrors): QuantityRule | undefined {
  if (!state.isLoose || !canSellLoose(state.unitKey)) return undefined;
  const rule = quantityRuleFromText({ min: state.looseMin, step: state.looseStep });
  if (rule === undefined) errors["quantityRule"] = INVALID_KEY;
  return rule;
}

function variantOf(
  state: OfferingFormState,
  row: VariantRow,
  context: { currency: Money["currency"]; rule: QuantityRule | undefined; errors: FieldErrors },
): VariantPayload {
  const { currency, rule, errors } = context;
  const hasValues = Object.keys(row.optionValues).length > 0;
  const compareAtPrice = optionalMoney(row.compareAtPrice, "compareAtPrice", { currency, errors });
  const overrides = overridesOf(state, row, errors);
  const stockComponents = stockComponentsOf(state, row, errors);
  return {
    ...(row.variantId ? { variantId: row.variantId } : {}),
    ...(hasValues
      ? { name: variantNameOf(row.optionValues), optionValues: { ...row.optionValues } }
      : {}),
    price: requiredMoney(row.price, hasValues ? "variants" : "price", { currency, errors }),
    ...(compareAtPrice ? { compareAtPrice } : {}),
    ...(row.sku.trim() ? { sku: row.sku.trim() } : {}),
    ...(row.barcode.trim() ? { barcode: row.barcode.trim() } : {}),
    unitKey: state.unitKey,
    ...(rule ? { quantityRule: rule } : {}),
    ...(overrides ? { overrides } : {}),
    ...(stockComponents ? { stockComponents } : {}),
  };
}

function rowsToSend(state: OfferingFormState): VariantRow[] {
  const first = state.rows[0];
  if (!state.hasOptions) return first ? [{ ...first, optionValues: {} }] : [];
  const hasUsableOptions = cleanOptions(state.options).length > 0;
  return hasUsableOptions ? state.rows : [];
}

/**
 * Turns the form into the API body, or into the errors to show. Money goes through the shared helper
 * (no floats, ADR-013); a field that is wrong is named so the person lands on it.
 */
export function buildOfferingPayload(
  state: OfferingFormState,
  currency: Money["currency"],
): BuildResult<OfferingPayload> {
  const errors: FieldErrors = {};
  if (state.name.trim() === "") errors["name"] = REQUIRED_KEY;
  const kindDetails = kindDetailsOf(state, currency, errors);
  const rule = ruleOf(state, errors);
  const rows = rowsToSend(state);
  if (rows.length === 0) errors["variants"] = REQUIRED_KEY;
  const variants = rows.map((row) => variantOf(state, row, { currency, rule, errors }));
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      name: state.name.trim(),
      description: state.description.trim() === "" ? null : state.description.trim(),
      categoryIds: state.categoryIds,
      modifierGroupIds: state.modifierGroupIds,
      imageFileIds: state.images.map((image) => image.fileId),
      taxClassKey: state.taxClassKey.trim() === "" ? null : state.taxClassKey.trim(),
      kindDetails,
      variants,
    },
  };
}
