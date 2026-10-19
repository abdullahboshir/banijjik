import { CATALOG_RECORD_STATUS, OFFERING_STATUS, UNITS } from "@banijjik/contracts/catalog";
import type { ModifierGroupId, OfferingId, OrganizationId } from "@banijjik/ids";
import { asId } from "@banijjik/ids";
import type { ModifierGroup } from "../domain/modifier-group.entity.js";
import { isActiveVariant, type Variant } from "../domain/variant.js";
import { invalidField, recordNotFound } from "../domain/errors.js";
import type { OfferingRepository } from "./ports/offering-repository.js";
import type {
  ModifierGroupRepository,
  OfferingLocationRepository,
  OfferingLocationRow,
} from "./ports/record-ports.js";

/** One line's catalog facts for the pricing quoter (card 3.4). */
export interface CatalogQuoteLineSource {
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: string;
  readonly categoryIds: readonly string[];
  readonly unitPriceMinor: number;
  readonly precision: number;
  readonly taxClassKey: string | undefined;
  readonly currency: string;
  readonly quantity: number;
  readonly isAvailable: boolean;
}

export interface CatalogQuoteLineRequest {
  readonly offeringId: OfferingId;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
}

export interface CatalogQuoteReader {
  readLines(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly CatalogQuoteLineRequest[];
  }): Promise<readonly CatalogQuoteLineSource[]>;
}

function assertQuantity(variant: Variant, quantity: number, path: string): void {
  const rule = variant.quantityRule;
  if (rule === undefined) {
    if (quantity < 1) throw invalidField(`${path}.quantity`, "errors.quote_quantity_invalid");
    return;
  }
  if (quantity < rule.min || quantity % rule.step !== 0) {
    throw invalidField(`${path}.quantity`, "errors.quote_quantity_invalid");
  }
  if (rule.max !== undefined && quantity > rule.max) {
    throw invalidField(`${path}.quantity`, "errors.quote_quantity_invalid");
  }
}

function pickActiveOptions(group: ModifierGroup, remaining: Set<string>): ModifierGroup["options"] {
  return group.options.filter(
    (option) =>
      option.status === CATALOG_RECORD_STATUS.ACTIVE && remaining.has(option.modifierOptionId),
  );
}

function assertModifierPick(input: {
  readonly group: ModifierGroup;
  readonly picked: ModifierGroup["options"];
  readonly currency: string;
  readonly linePath: string;
}): number {
  const { group, picked, currency, linePath } = input;
  const minimum = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
  if (picked.length < minimum || picked.length > group.maxSelect) {
    throw invalidField(`${linePath}.modifierOptionIds`, "errors.quote_modifier_invalid");
  }
  let delta = 0;
  for (const option of picked) {
    if (option.priceDelta.currency !== currency) {
      throw invalidField(`${linePath}.modifierOptionIds`, "errors.offering_currency_mismatch");
    }
    delta += option.priceDelta.amount;
  }
  return delta;
}

function modifierDelta(input: {
  readonly groups: readonly ModifierGroup[];
  readonly offeringGroupIds: readonly string[];
  readonly optionIds: readonly string[];
  readonly currency: string;
  readonly linePath: string;
}): number {
  const byId = new Map(input.groups.map((group) => [group.modifierGroupId, group]));
  const remaining = new Set(input.optionIds);
  let delta = 0;
  for (const groupId of input.offeringGroupIds) {
    const group = byId.get(asId<ModifierGroupId>(groupId));
    if (group === undefined || group.status !== CATALOG_RECORD_STATUS.ACTIVE) continue;
    const picked = pickActiveOptions(group, remaining);
    for (const option of picked) remaining.delete(option.modifierOptionId);
    delta += assertModifierPick({
      group,
      picked,
      currency: input.currency,
      linePath: input.linePath,
    });
  }
  if (remaining.size > 0) {
    throw invalidField(`${input.linePath}.modifierOptionIds`, "errors.quote_modifier_invalid");
  }
  return delta;
}

function resolveUnitPrice(input: {
  readonly variant: Variant;
  readonly locationRows: readonly OfferingLocationRow[];
  readonly offeringId: string;
  readonly locationId: string;
  readonly delta: number;
}): { readonly unitPriceMinor: number; readonly isAvailable: boolean } {
  const { variant, locationRows, offeringId, locationId, delta } = input;
  const variantRow = locationRows.find(
    (row) =>
      row.offeringId === offeringId &&
      row.locationId === locationId &&
      row.variantId === variant.variantId,
  );
  const offeringRow = locationRows.find(
    (row) =>
      row.offeringId === offeringId && row.locationId === locationId && row.variantId === undefined,
  );
  const isAvailable = variantRow?.isAvailable !== false && offeringRow?.isAvailable !== false;
  const override = variantRow?.priceOverride?.amount;
  return { unitPriceMinor: (override ?? variant.price.amount) + delta, isAvailable };
}

/** Loads ACTIVE offerings for a quote and folds location overrides and modifier deltas in. */
export function buildCatalogQuoteReader(dependencies: {
  readonly offerings: OfferingRepository;
  readonly locationRows: OfferingLocationRepository;
  readonly modifierGroups: ModifierGroupRepository;
}): CatalogQuoteReader {
  return {
    async readLines(input) {
      const offeringIds = [...new Set(input.lines.map((line) => line.offeringId))];
      const locationRows = await dependencies.locationRows.forLocation(
        offeringIds,
        input.locationId,
      );
      const sources: CatalogQuoteLineSource[] = [];
      for (const [index, request] of input.lines.entries()) {
        const path = `lines.${index}`;
        const offering = await dependencies.offerings.findById(request.offeringId);
        if (offering === undefined || offering.status !== OFFERING_STATUS.ACTIVE) {
          throw recordNotFound();
        }
        const variant = offering.variants.find((row) => row.variantId === request.variantId);
        if (variant === undefined || !isActiveVariant(variant)) throw recordNotFound();
        assertQuantity(variant, request.quantity, path);
        const groups = await dependencies.modifierGroups.findActiveByIds(offering.modifierGroupIds);
        const delta = modifierDelta({
          groups,
          offeringGroupIds: offering.modifierGroupIds,
          optionIds: request.modifierOptionIds,
          currency: variant.price.currency,
          linePath: path,
        });
        const priced = resolveUnitPrice({
          variant,
          locationRows,
          offeringId: offering.offeringId,
          locationId: input.locationId,
          delta,
        });
        sources.push({
          offeringId: offering.offeringId,
          variantId: variant.variantId,
          kind: offering.kind,
          categoryIds: offering.categoryIds,
          unitPriceMinor: priced.unitPriceMinor,
          precision: UNITS[variant.unitKey].precision,
          taxClassKey: offering.taxClassKey,
          currency: variant.price.currency,
          quantity: request.quantity,
          isAvailable: priced.isAvailable,
        });
      }
      return sources;
    },
  };
}
