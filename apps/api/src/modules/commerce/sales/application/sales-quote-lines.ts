import type { ManualDiscount } from "@banijjik/contracts/pricing";
import { asId, type OfferingId, type OrganizationId } from "@banijjik/ids";
import type { PreparedLines, OrderLineInput } from "./sales-line-preparation.js";
import { prepareOrderLines } from "./sales-line-preparation.js";
import type { SalesCatalogReader, SalesQuoter } from "./ports/sales-ports.js";

/** The only money path: the client never sends an amount, the quoter computes everything. */
export async function quoteAndPrepare(
  ports: {
    readonly quoter: SalesQuoter;
    readonly catalog: SalesCatalogReader;
  },
  input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly OrderLineInput[];
    readonly orderDiscount?: ManualDiscount | undefined;
  },
): Promise<PreparedLines> {
  const quote = await ports.quoter.quote({
    organizationId: input.organizationId,
    locationId: input.locationId,
    lines: input.lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: line.modifierOptionIds,
      ...(line.manualDiscount === undefined ? {} : { manualDiscount: line.manualDiscount }),
    })),
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
  return prepareOrderLines({ quote, catalogLines, lineInputs: input.lines });
}
