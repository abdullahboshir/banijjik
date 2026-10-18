import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CATALOG_EVENT_TYPE,
  OFFERING_STATUS,
  VARIANT_STATUS,
  type Money,
  type OfferingLocationResponse,
} from "@banijjik/contracts/catalog";
import type { OfferingId, OrganizationId, UserId } from "@banijjik/ids";
import {
  currencyMismatch,
  invalidField,
  invalidTransition,
  locationForbidden,
  recordNotFound,
} from "../../domain/errors.js";
import type { Offering } from "../../domain/offering.entity.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";

export interface OfferingLocationInput {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly offeringId: OfferingId;
  readonly locationId: string;
  readonly variantId?: string | undefined;
  /** The locations the caller's role reaches for `catalog.offering.update`. */
  readonly allowedLocationIds: readonly string[] | "ALL";
}

export interface SetOfferingLocationInput extends OfferingLocationInput {
  readonly isAvailable: boolean;
  readonly priceOverride?: Money | undefined;
}

async function requireOfferingAndLocation(
  dependencies: CatalogDependencies,
  input: OfferingLocationInput,
): Promise<Offering> {
  const { allowedLocationIds, locationId } = input;
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
  if (!(await dependencies.locationLookup.isActiveLocation(locationId))) {
    throw invalidField("locationId", "validation.invalid_value");
  }
  const offering = await dependencies.offerings.findById(input.offeringId);
  if (offering === undefined) throw recordNotFound();
  if (offering.status === OFFERING_STATUS.ARCHIVED) throw invalidTransition(offering.status);
  return offering;
}

function assertVariantIsActive(offering: Offering, variantId: string | undefined): void {
  if (variantId === undefined) return;
  const variant = offering.variants.find((candidate) => candidate.variantId === variantId);
  if (variant?.status !== VARIANT_STATUS.ACTIVE) {
    throw invalidField("variantId", "errors.offering_variant_unknown");
  }
}

async function recordChange(
  dependencies: CatalogDependencies,
  input: OfferingLocationInput,
  change: {
    readonly isAvailable: boolean | null;
    readonly priceOverride: number | null;
    /** Whether the price at this location changed, which fires `priceChanged`. */
    readonly hasPriceEffect: boolean;
  },
): Promise<void> {
  await dependencies.audit.record({
    action: AUDIT_ACTION.OFFERING_LOCATION_CHANGED,
    entityType: AUDIT_ENTITY_TYPE.offeringLocation,
    entityId: input.offeringId,
    changes: {
      locationId: { to: input.locationId },
      ...(input.variantId === undefined ? {} : { variantId: { to: input.variantId } }),
      isAvailable: { to: change.isAvailable },
      priceOverride: { to: change.priceOverride },
    },
  });
  if (change.hasPriceEffect) {
    await dependencies.events.publish(CATALOG_EVENT_TYPE.OFFERING_PRICE_CHANGED, {
      offeringId: input.offeringId,
    });
  }
}

/**
 * Turns an offering (or one variant) on or off at a location and sets a price for that location
 * (ADR-005). A location-scoped write: the location must be one the caller's role reaches for
 * `catalog.offering.update`. A price override needs a variant, because one price for every size
 * would be a mistake; it must be in the organization's currency.
 */
export class SetOfferingLocationUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: SetOfferingLocationInput): Promise<OfferingLocationResponse> {
    const { unitOfWork, locationRows, organization } = this.dependencies;
    if (input.priceOverride !== undefined && input.variantId === undefined) {
      throw invalidField("priceOverride", "validation.invalid_value");
    }
    const { currency } = await organization.read(input.organizationId);
    if (input.priceOverride !== undefined && input.priceOverride.currency !== currency) {
      throw currencyMismatch("priceOverride.currency");
    }
    await unitOfWork.run(async () => {
      const offering = await requireOfferingAndLocation(this.dependencies, input);
      assertVariantIsActive(offering, input.variantId);
      await locationRows.save(
        {
          offeringId: input.offeringId,
          variantId: input.variantId,
          locationId: input.locationId,
          isAvailable: input.isAvailable,
          priceOverride: input.priceOverride,
        },
        input.actorUserId,
      );
      await recordChange(this.dependencies, input, {
        isAvailable: input.isAvailable,
        priceOverride: input.priceOverride?.amount ?? null,
        hasPriceEffect: input.priceOverride !== undefined,
      });
    });
    return {
      offeringId: input.offeringId,
      variantId: input.variantId ?? null,
      locationId: input.locationId,
      isAvailable: input.isAvailable,
      priceOverride: input.priceOverride ?? null,
    };
  }
}

/** Returns an offering (or one variant) at a location to the organization defaults by removing its row. */
export class ClearOfferingLocationUseCase {
  constructor(private readonly dependencies: CatalogDependencies) {}

  async execute(input: OfferingLocationInput): Promise<void> {
    const { unitOfWork, locationRows } = this.dependencies;
    await unitOfWork.run(async () => {
      await requireOfferingAndLocation(this.dependencies, input);
      const removed = await locationRows.remove({
        offeringId: input.offeringId,
        locationId: input.locationId,
        ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
      });
      if (!removed) throw recordNotFound();
      await recordChange(this.dependencies, input, {
        isAvailable: null,
        priceOverride: null,
        hasPriceEffect: true,
      });
    });
  }
}
