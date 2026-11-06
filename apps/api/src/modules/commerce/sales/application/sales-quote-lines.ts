import type { OfferingKind } from "@banijjik/contracts";
import type { ManualDiscount, Money } from "@banijjik/contracts/pricing";
import type { FulfillmentMethod, OrderTotals } from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import { asId, type OfferingId, type OrganizationId } from "@banijjik/ids";
import { performerNotAtLocation } from "../domain/errors.js";
import { resolveDeliveryFee } from "./delivery-fee.js";
import type { DeliveryZoneRepository } from "./ports/delivery-zone.repository.js";
import type { SalesCatalogReader, SalesPerformerReader, SalesQuoter } from "./ports/sales-ports.js";
import type { OrderLineInput, PreparedLines } from "./sales-line-preparation.js";
import { prepareOrderLines, quoteTotalsOf, withDeliveryFee } from "./sales-line-preparation.js";

export interface DeliveryQuoteInput {
  readonly method: FulfillmentMethod;
  readonly address: DeliveryAddress | null;
}

function namedPerformers(lines: readonly OrderLineInput[]): string[] {
  const named = lines.flatMap((line) =>
    line.performedByMemberId === undefined || line.performedByMemberId === null
      ? []
      : [line.performedByMemberId],
  );
  return [...new Set(named)];
}

/**
 * A line may name a performer only when that member is ACTIVE and assigned at the order's location
 * (plan 3.11 Refresh C). One read covers every named member. A member of another organization is
 * absent too, because the tenant scope hides it.
 */
async function assertPerformersAssignable(
  performers: SalesPerformerReader,
  locationId: string,
  lines: readonly OrderLineInput[],
): Promise<void> {
  const named = namedPerformers(lines);
  if (named.length === 0) return;
  const assignable = await performers.filterAssignable(locationId, named);
  const refused = named.find((memberId) => !assignable.has(memberId));
  if (refused !== undefined) throw performerNotAtLocation(refused);
}

function quoteLineRequestsOf(lines: readonly OrderLineInput[]): readonly {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
  readonly manualDiscount?: ManualDiscount;
  readonly unitPriceOverride?: Money;
}[] {
  return lines.map((line) => ({
    offeringId: line.offeringId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierOptionIds: line.modifierOptionIds,
    ...(line.manualDiscount === undefined ? {} : { manualDiscount: line.manualDiscount }),
    ...(line.unitPriceOverride === undefined ? {} : { unitPriceOverride: line.unitPriceOverride }),
  }));
}

async function pricedDeliveryOf(
  ports: { readonly deliveryZones: DeliveryZoneRepository },
  input: {
    readonly organizationId: OrganizationId;
    readonly delivery: DeliveryQuoteInput;
    readonly currency: Money["currency"];
  },
): Promise<{ readonly deliveryZoneId: string | null; readonly fee: Money }> {
  return resolveDeliveryFee(ports, {
    organizationId: input.organizationId,
    method: input.delivery.method,
    address: input.delivery.address,
    currency: input.currency,
  });
}

/** The only money path: the client never sends an amount, the quoter computes everything. */
export async function quoteAndPrepare(
  ports: {
    readonly quoter: SalesQuoter;
    readonly catalog: SalesCatalogReader;
    readonly performers: SalesPerformerReader;
    readonly deliveryZones: DeliveryZoneRepository;
  },
  input: {
    readonly allowedKinds: readonly OfferingKind[];
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly OrderLineInput[];
    readonly orderDiscount?: ManualDiscount | undefined;
    readonly delivery: DeliveryQuoteInput;
  },
): Promise<PreparedLines> {
  await assertPerformersAssignable(ports.performers, input.locationId, input.lines);
  const quote = await ports.quoter.quote({
    organizationId: input.organizationId,
    locationId: input.locationId,
    lines: quoteLineRequestsOf(input.lines),
    ...(input.orderDiscount === undefined ? {} : { orderDiscount: input.orderDiscount }),
  });
  const catalogLines = await ports.catalog.readLines({
    organizationId: input.organizationId,
    locationId: input.locationId,
    lines: input.lines.map((line) => ({
      offeringId: asId<OfferingId>(line.offeringId),
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: line.modifierOptionIds,
    })),
  });
  const prepared = prepareOrderLines({
    quote,
    catalogLines,
    lineInputs: input.lines,
    allowedKinds: input.allowedKinds,
  });
  const resolved = await pricedDeliveryOf(ports, {
    organizationId: input.organizationId,
    delivery: input.delivery,
    currency: quote.totals.grandTotal.currency,
  });
  return {
    ...prepared,
    totals: withDeliveryFee(prepared.totals, resolved.fee),
    deliveryZoneId: resolved.deliveryZoneId,
  };
}

/**
 * Quotes stored lines and prices the fee without `prepareOrderLines`, so no `orderLineId` is
 * re-minted and no catalog or performer read is repeated (the lines themselves did not change).
 */
export async function repriceStoredLines(
  ports: {
    readonly quoter: SalesQuoter;
    readonly deliveryZones: DeliveryZoneRepository;
  },
  input: {
    readonly allowedKinds: readonly OfferingKind[];
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly OrderLineInput[];
    readonly orderDiscount?: ManualDiscount | undefined;
    readonly delivery: DeliveryQuoteInput;
  },
): Promise<{ readonly totals: OrderTotals; readonly deliveryZoneId: string | null }> {
  void input.allowedKinds;
  const quote = await ports.quoter.quote({
    organizationId: input.organizationId,
    locationId: input.locationId,
    lines: quoteLineRequestsOf(input.lines),
    ...(input.orderDiscount === undefined ? {} : { orderDiscount: input.orderDiscount }),
  });
  const resolved = await pricedDeliveryOf(ports, {
    organizationId: input.organizationId,
    delivery: input.delivery,
    currency: quote.totals.grandTotal.currency,
  });
  return {
    totals: withDeliveryFee(quoteTotalsOf(quote), resolved.fee),
    deliveryZoneId: resolved.deliveryZoneId,
  };
}
