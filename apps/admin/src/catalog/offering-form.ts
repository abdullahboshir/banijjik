import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import {
  BILLING_PERIOD_UNIT,
  BOOKING_MODE,
  PLAN_START_RULE,
  VARIANT_STATUS,
  type BillingPeriodUnit,
  type BookingMode,
  type Money,
  type OfferingResponse,
  type PlanStartRule,
  type StockComponent,
  type UnitKey,
  type VariantResponse,
} from "@banijjik/contracts/catalog";
import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import { moneyToInputText } from "@banijjik/web-client";
import { quantityRuleToText } from "./quantity-rule";
import { optionsOfRows, type OptionDraft, type OptionValues } from "./variant-generator";

export interface ImageState {
  fileId: string;
  url: string;
}

/** The kind-specific fields as the person types them: text stays text until the body is built. */
export interface DetailsState {
  requiresShipping: boolean;
  weightGrams: string;
  durationMinutes: string;
  bufferAfterMinutes: string;
  bookingMode: BookingMode;
  billingUnit: BillingPeriodUnit;
  billingCount: string;
  admissionFee: string;
  capacity: string;
  sessionLimitPerPeriod: string;
  startRule: PlanStartRule;
  startDates: string;
}

export interface StockComponentDraft {
  inventoryItemId: string;
  quantity: string;
  item?: InventoryItemListItem | undefined;
}

export interface VariantRow {
  variantId?: string | undefined;
  optionValues: OptionValues;
  price: string;
  compareAtPrice: string;
  sku: string;
  barcode: string;
  /** The one value this kind lets a variant override: minutes, billing months or grams. */
  override: string;
  stockComponents: StockComponentDraft[];
}

export interface OfferingFormState {
  offeringId?: string | undefined;
  version?: number | undefined;
  kind: OfferingKind;
  name: string;
  description: string;
  categoryIds: string[];
  modifierGroupIds: string[];
  images: ImageState[];
  /** Empty means the business default tax class (or 0% when that is empty). */
  taxClassKey: string;
  unitKey: UnitKey;
  isLoose: boolean;
  looseMin: string;
  looseStep: string;
  details: DetailsState;
  hasOptions: boolean;
  options: OptionDraft[];
  /** Without options these hold the one hidden "Default" variant. */
  rows: VariantRow[];
}

export const DEFAULT_BILLING_COUNT = "1";
export const DEFAULT_SERVICE_MINUTES = "30";

export function emptyRow(optionValues: OptionValues = {}): VariantRow {
  return {
    optionValues,
    price: "",
    compareAtPrice: "",
    sku: "",
    barcode: "",
    override: "",
    stockComponents: [],
  };
}

function stockComponentsOf(components: readonly StockComponent[]): StockComponentDraft[] {
  return components.map((component) => ({
    inventoryItemId: component.inventoryItemId,
    quantity: String(component.quantity),
  }));
}

function emptyDetails(): DetailsState {
  return {
    requiresShipping: true,
    weightGrams: "",
    durationMinutes: DEFAULT_SERVICE_MINUTES,
    bufferAfterMinutes: "0",
    bookingMode: BOOKING_MODE.SLOT,
    billingUnit: BILLING_PERIOD_UNIT.MONTH,
    billingCount: DEFAULT_BILLING_COUNT,
    admissionFee: "",
    capacity: "",
    sessionLimitPerPeriod: "",
    startRule: PLAN_START_RULE.ANY_DATE,
    startDates: "",
  };
}

export function newOfferingForm(kind: OfferingKind, unitKey: UnitKey): OfferingFormState {
  return {
    kind,
    name: "",
    description: "",
    categoryIds: [],
    modifierGroupIds: [],
    images: [],
    taxClassKey: "",
    unitKey,
    isLoose: false,
    looseMin: "",
    looseStep: "",
    details: emptyDetails(),
    hasOptions: false,
    options: [],
    rows: [emptyRow()],
  };
}

/** The name of the one field a variant may override for this kind, or none (RENTAL and EVENT have none). */
export function overrideFieldOf(
  kind: OfferingKind,
): "durationMinutes" | "billingCount" | "weightGrams" | undefined {
  if (kind === OFFERING_KIND.SERVICE) return "durationMinutes";
  if (kind === OFFERING_KIND.PLAN) return "billingCount";
  if (kind === OFFERING_KIND.PRODUCT) return "weightGrams";
  return undefined;
}

function textOf(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function moneyText(money: Money | null | undefined): string {
  return money ? moneyToInputText(money) : "";
}

function overrideTextOf(kind: OfferingKind, variant: VariantResponse): string {
  const { overrides } = variant;
  if (kind === OFFERING_KIND.SERVICE) return textOf(overrides.durationMinutes);
  if (kind === OFFERING_KIND.PLAN) return textOf(overrides.billingPeriod?.count);
  return textOf(overrides.weightGrams);
}

function rowOfVariant(kind: OfferingKind, variant: VariantResponse): VariantRow {
  return {
    variantId: variant.variantId,
    optionValues: variant.optionValues,
    price: moneyText(variant.price),
    compareAtPrice: moneyText(variant.compareAtPrice),
    sku: variant.sku ?? "",
    barcode: variant.barcode ?? "",
    override: overrideTextOf(kind, variant),
    stockComponents: stockComponentsOf(variant.stockComponents),
  };
}

function detailsOfOffering(offering: OfferingResponse): DetailsState {
  const details = emptyDetails();
  const stored = offering.kindDetails as unknown as Record<string, unknown>;
  const text = (key: string): string => (stored[key] === undefined ? "" : String(stored[key]));
  if (offering.kind === OFFERING_KIND.PRODUCT) {
    return {
      ...details,
      requiresShipping: stored["requiresShipping"] !== false,
      weightGrams: text("weightGrams"),
    };
  }
  if (offering.kind === OFFERING_KIND.SERVICE) {
    return {
      ...details,
      durationMinutes: text("durationMinutes"),
      bufferAfterMinutes: text("bufferAfterMinutes") || "0",
      bookingMode: stored["bookingMode"] as BookingMode,
    };
  }
  return offering.kind === OFFERING_KIND.PLAN ? planDetailsOf(details, stored) : details;
}

function planDetailsOf(details: DetailsState, stored: Record<string, unknown>): DetailsState {
  const period = stored["billingPeriod"] as { unit: BillingPeriodUnit; count: number };
  const startDates = stored["startDates"] as string[] | undefined;
  return {
    ...details,
    billingUnit: period.unit,
    billingCount: String(period.count),
    admissionFee: moneyText(stored["admissionFee"] as Money | undefined),
    capacity: textOf(stored["capacity"] as number | undefined),
    sessionLimitPerPeriod: textOf(stored["sessionLimitPerPeriod"] as number | undefined),
    startRule: stored["startRule"] as PlanStartRule,
    startDates: (startDates ?? []).join("\n"),
  };
}

/** The form for an offering that exists: only the ACTIVE variants are shown, archived ones stay archived. */
export function formFromOffering(offering: OfferingResponse): OfferingFormState {
  const active = offering.variants.filter((variant) => variant.status === VARIANT_STATUS.ACTIVE);
  const rows = active.map((variant) => rowOfVariant(offering.kind, variant));
  const first = active[0];
  const rule = quantityRuleToText(first?.quantityRule ?? null);
  const hasOptions = rows.some((row) => Object.keys(row.optionValues).length > 0);
  return {
    offeringId: offering.offeringId,
    version: offering.version,
    kind: offering.kind,
    name: offering.name,
    description: offering.description ?? "",
    categoryIds: offering.categories.map((category) => category.referenceId),
    modifierGroupIds: offering.modifierGroups.map((group) => group.referenceId),
    images: offering.images.map((image) => ({ fileId: image.fileId, url: image.url })),
    taxClassKey: offering.taxClassKey ?? "",
    unitKey: first?.unitKey ?? "PIECE",
    isLoose: first?.quantityRule != null,
    looseMin: rule.min,
    looseStep: rule.step,
    details: detailsOfOffering(offering),
    hasOptions,
    options: optionsOfRows(rows),
    rows: rows.length > 0 ? rows : [emptyRow()],
  };
}
