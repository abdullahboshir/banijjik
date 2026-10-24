import { OFFERING_KIND } from "@banijjik/contracts";
import {
  OFFERING_STATUS,
  type EventDetails,
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

function asEventDetails(kindDetails: unknown): EventDetails | undefined {
  if (kindDetails === null || typeof kindDetails !== "object") return undefined;
  const record = kindDetails as EventDetails;
  if (typeof record.salesCloseMinutesBefore !== "number") return undefined;
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

type StoredOffering = NonNullable<Awaited<ReturnType<MongoOfferingRepository["findById"]>>>;
type StoredVariant = NonNullable<StoredOffering["variants"][number]>;

interface LoadedOfferingVariant {
  readonly offering: StoredOffering;
  readonly variant: StoredVariant;
}

async function readActiveVariant(
  offerings: MongoOfferingRepository,
  offeringId: OfferingId,
  variantId: string,
): Promise<LoadedOfferingVariant | undefined> {
  const offering = await offerings.findById(offeringId);
  if (offering === undefined) return undefined;
  if (offering.status !== OFFERING_STATUS.ACTIVE) return undefined;
  const variant = offering.variants.find((row) => row.variantId === variantId);
  if (variant === undefined || !isActiveVariant(variant)) return undefined;
  return { offering, variant };
}

/**
 * One view per kind. Kind details the module cannot read mean the offering is not bookable here,
 * so the caller gets the same refusal as for an unknown kind.
 */
function toOfferingBookingView(input: {
  readonly loaded: LoadedOfferingVariant;
  readonly offeringId: OfferingId;
  readonly isAvailable: boolean;
}): OfferingBookingView | undefined {
  const common = {
    offeringId: input.offeringId,
    variantId: input.loaded.variant.variantId,
    name: input.loaded.offering.name,
    isActive: input.isAvailable,
  };
  if (input.loaded.offering.kind === OFFERING_KIND.SERVICE) {
    const service = asServiceDetails(input.loaded.offering.kindDetails);
    if (service === undefined) return undefined;
    return {
      ...common,
      kind: OFFERING_KIND.SERVICE,
      service,
      durationMinutes: input.loaded.variant.overrides.durationMinutes ?? service.durationMinutes,
    };
  }
  if (input.loaded.offering.kind === OFFERING_KIND.RENTAL) {
    const rental = asRentalDetails(input.loaded.offering.kindDetails);
    if (rental === undefined) return undefined;
    return { ...common, kind: OFFERING_KIND.RENTAL, rental };
  }
  if (input.loaded.offering.kind === OFFERING_KIND.EVENT) {
    const event = asEventDetails(input.loaded.offering.kindDetails);
    if (event === undefined) return undefined;
    return { ...common, kind: OFFERING_KIND.EVENT, event };
  }
  return undefined;
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
      return toOfferingBookingView({
        loaded,
        offeringId: input.offeringId,
        isAvailable: isBookableAtLocation(rows, loaded.variant.variantId),
      });
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
