import { OFFERING_KIND } from "@banijjik/contracts";
import { OFFERING_STATUS } from "@banijjik/contracts/catalog";
import {
  isActiveVariant,
  MongoOfferingLocationRepository,
  MongoOfferingRepository,
} from "../../catalog/index.js";
import type { EventSessionOfferingReader } from "../application/ports/event-session-offering-reader.js";

function isAvailableAtLocation(
  rows: readonly { variantId?: string | undefined; isAvailable?: boolean | undefined }[],
  variantId: string,
): boolean {
  const variantRow = rows.find((row) => row.variantId === variantId);
  const offeringRow = rows.find((row) => row.variantId === undefined);
  return variantRow?.isAvailable !== false && offeringRow?.isAvailable !== false;
}

export function buildEventSessionOfferingReader(): EventSessionOfferingReader {
  const offerings = new MongoOfferingRepository();
  const locations = new MongoOfferingLocationRepository();
  return {
    async readEventOffering(input) {
      const offering = await offerings.findById(input.offeringId);
      if (offering === undefined || offering.kind !== OFFERING_KIND.EVENT) return undefined;
      if (offering.status !== OFFERING_STATUS.ACTIVE) return undefined;
      const variant = offering.variants.find((row) => row.variantId === input.variantId);
      if (variant === undefined || !isActiveVariant(variant)) return undefined;
      const rows = await locations.forLocation([input.offeringId], input.locationId);
      if (!isAvailableAtLocation(rows, input.variantId)) return undefined;
      return { offeringId: input.offeringId, variantId: input.variantId, name: offering.name };
    },
  };
}
