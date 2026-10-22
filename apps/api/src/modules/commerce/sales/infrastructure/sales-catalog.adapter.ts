import { OFFERING_STATUS } from "@banijjik/contracts/catalog";
import type { OfferingId, OrganizationId } from "@banijjik/ids";
import type { Money, OrderLineModifierSnapshot } from "@banijjik/contracts/sales";
import { recordNotFound } from "../domain/errors.js";
import type {
  SalesCatalogLine,
  SalesCatalogLineRequest,
  SalesCatalogReader,
} from "../application/ports/sales-ports.js";
import {
  isActiveVariant,
  MongoModifierGroupRepository,
  MongoOfferingRepository,
} from "../../catalog/index.js";

type LoadedOffering = NonNullable<Awaited<ReturnType<MongoOfferingRepository["findById"]>>>;
type LoadedGroup = NonNullable<
  Awaited<ReturnType<MongoModifierGroupRepository["findActiveByIds"]>>
>[number];

async function loadActiveOffering(
  offerings: MongoOfferingRepository,
  offeringId: OfferingId,
): Promise<LoadedOffering> {
  const offering = await offerings.findById(offeringId);
  if (offering === undefined || offering.status !== OFFERING_STATUS.ACTIVE) throw recordNotFound();
  return offering;
}

function pickedModifiersOf(
  group: LoadedGroup,
  optionIds: readonly string[],
): readonly OrderLineModifierSnapshot[] {
  return group.options
    .filter((option) => optionIds.includes(option.modifierOptionId))
    .map((option) => ({
      modifierGroupId: group.modifierGroupId,
      modifierOptionId: option.modifierOptionId,
      nameSnapshot: option.name,
      // A catalog money value is already the org currency; the quoter rejects a mismatch.
      priceDelta: option.priceDelta as Money,
    }));
}

/**
 * The order's own catalog read: it freezes the name, modifiers, tax class and stock components.
 * Prices, availability and the quantity rule are the quoter's job (plan decision 3).
 */
export function buildSalesCatalogReader(): SalesCatalogReader {
  const offerings = new MongoOfferingRepository();
  const modifierGroups = new MongoModifierGroupRepository();

  async function readLine(request: SalesCatalogLineRequest): Promise<SalesCatalogLine> {
    const offering = await loadActiveOffering(offerings, request.offeringId);
    const variant = offering.variants.find((row) => row.variantId === request.variantId);
    if (variant === undefined || !isActiveVariant(variant)) throw recordNotFound();
    const groups = await modifierGroups.findActiveByIds(offering.modifierGroupIds);
    const modifiers = groups.flatMap((group) =>
      pickedModifiersOf(group, request.modifierOptionIds),
    );
    return {
      offeringId: request.offeringId,
      variantId: variant.variantId,
      kind: offering.kind,
      nameSnapshot: offering.name,
      modifiers,
      stockComponents: variant.stockComponents,
      taxClassKey: offering.taxClassKey ?? null,
    };
  }

  return {
    async readLines(input: {
      readonly organizationId: OrganizationId;
      readonly locationId: string;
      readonly lines: readonly SalesCatalogLineRequest[];
    }): Promise<readonly SalesCatalogLine[]> {
      return Promise.all(input.lines.map(readLine));
    },
  };
}
