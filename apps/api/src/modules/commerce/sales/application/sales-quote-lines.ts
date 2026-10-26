import type { OfferingKind } from "@banijjik/contracts";
import type { ManualDiscount } from "@banijjik/contracts/pricing";
import { asId, type OfferingId, type OrganizationId } from "@banijjik/ids";
import { performerNotAtLocation } from "../domain/errors.js";
import type { PreparedLines, OrderLineInput } from "./sales-line-preparation.js";
import { prepareOrderLines } from "./sales-line-preparation.js";
import type {
  SalesCatalogReader,
  SalesKindReader,
  SalesPerformerReader,
  SalesQuoter,
} from "./ports/sales-ports.js";

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

/** The only money path: the client never sends an amount, the quoter computes everything. */
export async function quoteAndPrepare(
  ports: {
    readonly quoter: SalesQuoter;
    readonly catalog: SalesCatalogReader;
    readonly performers: SalesPerformerReader;
    readonly kinds: SalesKindReader;
  },
  input: {
    readonly allowedKinds: readonly OfferingKind[];
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly OrderLineInput[];
    readonly orderDiscount?: ManualDiscount | undefined;
  },
): Promise<PreparedLines> {
  await assertPerformersAssignable(ports.performers, input.locationId, input.lines);
  const quote = await ports.quoter.quote({
    organizationId: input.organizationId,
    locationId: input.locationId,
    lines: input.lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
      modifierOptionIds: line.modifierOptionIds,
      ...(line.manualDiscount === undefined ? {} : { manualDiscount: line.manualDiscount }),
      ...(line.unitPriceOverride === undefined
        ? {}
        : { unitPriceOverride: line.unitPriceOverride }),
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
  const effectiveKinds = await ports.kinds.effectiveKinds(input.organizationId);
  const allowedKinds = input.allowedKinds.filter((kind) => effectiveKinds.includes(kind));
  return prepareOrderLines({ quote, catalogLines, lineInputs: input.lines, allowedKinds });
}
