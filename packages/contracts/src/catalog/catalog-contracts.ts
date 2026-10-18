import { defineEnum } from "../define-enum.js";
import type { CurrencyCode } from "../organization/currency-code.js";
import type { OfferingKind } from "../modules/offering-kind.js";
import type { UnitKey } from "./unit-registry.js";

/** Money in JSON: an integer of minor units plus the currency code (05-CONVENTIONS, ADR-013). */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** DRAFT (for example from a social post) never reaches the bot or the storefront (ADR-026). */
export const OFFERING_STATUS = defineEnum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type OfferingStatus = (typeof OFFERING_STATUS)[keyof typeof OFFERING_STATUS];

/** A variant id once used is never reused or deleted: orders and bookings reference it (ADR-098). */
export const VARIANT_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type VariantStatus = (typeof VARIANT_STATUS)[keyof typeof VARIANT_STATUS];

export const CATALOG_RECORD_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type CatalogRecordStatus =
  (typeof CATALOG_RECORD_STATUS)[keyof typeof CATALOG_RECORD_STATUS];

/** Add-on groups (ADR-072): pick one option, or several. */
export const MODIFIER_SELECTION = defineEnum(["SINGLE", "MULTIPLE"]);
export type ModifierSelection = (typeof MODIFIER_SELECTION)[keyof typeof MODIFIER_SELECTION];

export const BOOKING_MODE = defineEnum(["SLOT", "WALK_IN_ONLY"]);
export type BookingMode = (typeof BOOKING_MODE)[keyof typeof BOOKING_MODE];

export const BILLING_PERIOD_UNIT = defineEnum(["DAY", "WEEK", "MONTH", "YEAR"]);
export type BillingPeriodUnit = (typeof BILLING_PERIOD_UNIT)[keyof typeof BILLING_PERIOD_UNIT];

export const PLAN_START_RULE = defineEnum(["ANY_DATE", "FIXED_DATES"]);
export type PlanStartRule = (typeof PLAN_START_RULE)[keyof typeof PLAN_START_RULE];

export const RENTAL_RATE_UNIT = defineEnum(["HOUR", "DAY", "NIGHT"]);
export type RentalRateUnit = (typeof RENTAL_RATE_UNIT)[keyof typeof RENTAL_RATE_UNIT];

/** How a service asks for a deposit (11 section 5.4); the same four choices as the `booking.deposit.required` setting. */
export const DEPOSIT_REQUIRED = defineEnum(["NONE", "FIXED", "PERCENT", "FULL"]);
export type DepositRequired = (typeof DEPOSIT_REQUIRED)[keyof typeof DEPOSIT_REQUIRED];

export const CATALOG_DEFAULT_UNIT_SETTING_KEY = "catalog.defaultUnitKey";
export const CATALOG_DEFAULT_STOCK_TRACKED_SETTING_KEY = "catalog.defaultStockTracked";

export const MAX_VARIANTS_PER_OFFERING = 100;
export const MAX_OPTION_NAMES_PER_VARIANT = 3;
export const MAX_STOCK_COMPONENTS = 10;
export const MAX_OFFERING_DESCRIPTION_LENGTH = 5000;
export const MAX_OFFERING_SYNONYMS = 20;
export const MAX_SYNONYM_LENGTH = 40;
export const MAX_OFFERING_CATEGORIES = 10;
export const MAX_OFFERING_MODIFIER_GROUPS = 10;
export const MAX_OFFERING_IMAGES = 10;
export const MAX_CATEGORY_DEPTH = 3;
export const MAX_MODIFIER_OPTIONS = 30;
export const MAX_ORGANIZATION_SYNONYM_TERMS = 200;
export const OFFERING_NAME_MAX_LENGTH = 160;
export const OFFERING_SLUG_MAX_LENGTH = 80;

export interface QuantityRule {
  readonly min: number;
  readonly step: number;
  readonly max?: number | undefined;
}

export interface StockComponent {
  readonly inventoryItemId: string;
  readonly quantity: number;
}

export interface BillingPeriod {
  readonly unit: BillingPeriodUnit;
  readonly count: number;
}

export interface DepositRule {
  readonly required: DepositRequired;
  /** Minor units for FIXED, a whole percent (1 to 100) for PERCENT; absent for NONE and FULL. */
  readonly value?: number;
}

export interface ProductDetails {
  readonly requiresShipping: boolean;
  readonly weightGrams?: number;
  readonly dimensionsCm?: { readonly l: number; readonly w: number; readonly h: number };
}

export interface ServiceDetails {
  readonly durationMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly requiresResource: boolean;
  readonly resourceTypeKeys: readonly string[];
  readonly bookingMode: BookingMode;
  readonly maxAdvanceDays: number;
  readonly depositRule?: DepositRule;
}

export interface PlanDetails {
  readonly billingPeriod: BillingPeriod;
  readonly admissionFee?: Money;
  readonly sessionLimitPerPeriod?: number;
  readonly capacity?: number;
  readonly startRule: PlanStartRule;
  readonly startDates?: readonly string[];
  readonly fixedTermPeriods?: number;
  readonly autoRenewDefault: boolean;
  readonly freezeAllowed: boolean;
  readonly maxFreezeDaysPerYear?: number;
  readonly securityDeposit?: Money;
}

export interface RentalDetails {
  readonly rateUnit: RentalRateUnit;
  readonly minUnits: number;
  readonly maxUnits?: number;
  readonly resourceTypeKeys: readonly string[];
  readonly checkInTime?: string;
  readonly checkOutTime?: string;
  readonly depositAmount?: Money;
}

export interface EventDetails {
  readonly salesCloseMinutesBefore: number;
  readonly allowWaitlist: boolean;
}

/** The fields that belong to one kind (11 section 2). Which one applies is decided by the offering's `kind`. */
export type KindDetails =
  ProductDetails | ServiceDetails | PlanDetails | RentalDetails | EventDetails;

/** The "variant may override" column of 11 section 2, and nothing else. */
export interface VariantOverrides {
  readonly weightGrams?: number;
  readonly durationMinutes?: number;
  readonly billingPeriod?: BillingPeriod;
  readonly sessionLimitPerPeriod?: number;
}

export interface VariantResponse {
  readonly variantId: string;
  readonly name: string;
  readonly optionValues: Readonly<Record<string, string>>;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly unitKey: UnitKey;
  readonly quantityRule: QuantityRule | null;
  readonly stockComponents: readonly StockComponent[];
  readonly overrides: VariantOverrides;
  readonly status: VariantStatus;
}

export interface OfferingImageResponse {
  readonly fileId: string;
  /** The public address of the medium size; images of an offering are PUBLIC files (ADR-109). */
  readonly url: string;
}

export interface NamedReference {
  readonly referenceId: string;
  readonly name: string;
}

export interface OfferingResponse {
  readonly offeringId: string;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug: string;
  readonly status: OfferingStatus;
  readonly description: string | null;
  readonly categories: readonly NamedReference[];
  readonly modifierGroups: readonly NamedReference[];
  readonly images: readonly OfferingImageResponse[];
  readonly variants: readonly VariantResponse[];
  readonly kindDetails: KindDetails;
  readonly taxClassKey: string | null;
  readonly synonyms: readonly string[];
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One row of `GET /offerings`: lean, with the price and availability for the asked location. */
export interface OfferingListItem {
  readonly offeringId: string;
  readonly kind: OfferingKind;
  readonly name: string;
  readonly slug: string;
  readonly status: OfferingStatus;
  readonly firstImageUrl: string | null;
  /** The lowest ACTIVE variant price, after any location override. */
  readonly priceFrom: Money | null;
  readonly variantCount: number;
  readonly categoryIds: readonly string[];
  /** Present only when `?location=` was given: false when the location turned the offering off. */
  readonly isAvailable?: boolean;
  readonly updatedAt: string;
}

export interface CategoryResponse {
  readonly categoryId: string;
  readonly name: string;
  readonly slug: string;
  readonly parentCategoryId: string | null;
  readonly sortOrder: number;
  readonly imageFileId: string | null;
  readonly imageUrl: string | null;
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly status: CatalogRecordStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ModifierOptionResponse {
  readonly modifierOptionId: string;
  readonly name: string;
  readonly priceDelta: Money;
  readonly status: CatalogRecordStatus;
}

export interface ModifierGroupResponse {
  readonly modifierGroupId: string;
  readonly name: string;
  readonly selection: ModifierSelection;
  readonly isRequired: boolean;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly options: readonly ModifierOptionResponse[];
  readonly status: CatalogRecordStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The per-location row of an offering or one of its variants (ADR-005): no row means the organization defaults. */
export interface OfferingLocationResponse {
  readonly offeringId: string;
  readonly variantId: string | null;
  readonly locationId: string;
  readonly isAvailable: boolean;
  readonly priceOverride: Money | null;
}

export interface SynonymEntry {
  readonly term: string;
  readonly synonyms: readonly string[];
}

export interface SynonymsResponse {
  readonly entries: readonly SynonymEntry[];
  readonly version: number;
}

/** Payload of every catalog event: ids only. */
export interface OfferingEventPayload {
  readonly offeringId: string;
}
