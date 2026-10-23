import { OFFERING_KIND } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  type RentalDetails,
  type ServiceDetails,
} from "@banijjik/contracts/catalog";
import type { LocationId, OfferingId, OrganizationId } from "@banijjik/ids";
import {
  isActiveVariant,
  MongoOfferingLocationRepository,
  MongoOfferingRepository,
} from "../../catalog/index.js";
import type {
  BookingOfferingReader,
  OfferingBookingView,
  ServiceOfferingView,
} from "../application/ports/booking-context-ports.js";

function asServiceDetails(kindDetails: unknown): ServiceDetails | undefined {
  if (kindDetails === null || typeof kindDetails !== "object") return undefined;
  const record = kindDetails as ServiceDetails;
  if (typeof record.durationMinutes !== "number") return undefined;
  return record;
}

function asRentalDetails(kindDetails: unknown): RentalDetails | undefined {
  if (kindDetails === null || typeof kindDetails !== "object") return undefined;
  const record = kindDetails as RentalDetails;
  if (typeof record.rateUnit !== "string") return undefined;
  return record;
}

function isBookableAtLocation(
  rows: readonly { variantId?: string | undefined; isAvailable?: boolean | undefined }[],
  variantId: string,
): boolean {
  const variantRow = rows.find((row) => row.variantId === variantId);
  const offeringRow = rows.find((row) => row.variantId === undefined);
  return variantRow?.isAvailable !== false && offeringRow?.isAvailable !== false;
}

async function readActiveVariant(
  offerings: MongoOfferingRepository,
  offeringId: OfferingId,
  variantId: string,
): Promise<
  | {
      offering: NonNullable<Awaited<ReturnType<MongoOfferingRepository["findById"]>>>;
      variant: NonNullable<
        NonNullable<Awaited<ReturnType<MongoOfferingRepository["findById"]>>>["variants"][number]
      >;
    }
  | undefined
> {
  const offering = await offerings.findById(offeringId);
  if (offering === undefined) return undefined;
  if (offering.status !== OFFERING_STATUS.ACTIVE) return undefined;
  const variant = offering.variants.find((row) => row.variantId === variantId);
  if (variant === undefined || !isActiveVariant(variant)) return undefined;
  return { offering, variant };
}

export function buildBookingOfferingReader(): BookingOfferingReader {
  const offerings = new MongoOfferingRepository();
  const locations = new MongoOfferingLocationRepository();
  return {
    async readOffering(input: {
      readonly organizationId: OrganizationId;
      readonly offeringId: OfferingId;
      readonly variantId: string;
      readonly locationId: LocationId;
    }): Promise<OfferingBookingView | undefined> {
      void input.organizationId;
      const loaded = await readActiveVariant(offerings, input.offeringId, input.variantId);
      if (loaded === undefined) return undefined;

      const rows = await locations.forLocation([input.offeringId], input.locationId);
      const isAvailable = isBookableAtLocation(rows, loaded.variant.variantId);

      if (loaded.offering.kind === OFFERING_KIND.SERVICE) {
        const service = asServiceDetails(loaded.offering.kindDetails);
        if (service === undefined) return undefined;
        const durationMinutes = loaded.variant.overrides.durationMinutes ?? service.durationMinutes;
        return {
          kind: OFFERING_KIND.SERVICE,
          offeringId: input.offeringId,
          variantId: loaded.variant.variantId,
          name: loaded.offering.name,
          service,
          durationMinutes,
          isActive: isAvailable,
        };
      }

      if (loaded.offering.kind === OFFERING_KIND.RENTAL) {
        const rental = asRentalDetails(loaded.offering.kindDetails);
        if (rental === undefined) return undefined;
        return {
          kind: OFFERING_KIND.RENTAL,
          offeringId: input.offeringId,
          variantId: loaded.variant.variantId,
          name: loaded.offering.name,
          rental,
          isActive: isAvailable,
        };
      }

      return undefined;
    },

    async readServiceOffering(input: {
      readonly organizationId: OrganizationId;
      readonly offeringId: OfferingId;
      readonly variantId: string;
      readonly locationId: LocationId;
    }): Promise<ServiceOfferingView | undefined> {
      const offering = await this.readOffering(input);
      if (offering === undefined || offering.kind !== OFFERING_KIND.SERVICE) {
        return undefined;
      }
      return offering;
    },
  };
}
