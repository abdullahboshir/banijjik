import type { EffectiveCustomField, EventPayloadMap, OfferingKind } from "@banijjik/contracts";
import type { CatalogEventType, UnitKey } from "@banijjik/contracts/catalog";
import type { OrganizationId } from "@banijjik/ids";

/** What catalog needs to know about the organization: its currency and the kinds its template allows (ADR-033). */
export interface OrganizationCatalogContext {
  read(organizationId: OrganizationId): Promise<{
    readonly currency: string;
    readonly kinds: readonly OfferingKind[];
  }>;
}

/** The effective custom fields of the catalog entities (ADR-102), adapted from the custom-field engine in routes. */
export interface CatalogCustomFieldReader {
  /** Fields of this kind plus those without a kind. */
  forOffering(
    organizationId: OrganizationId,
    kind: OfferingKind,
  ): Promise<readonly EffectiveCustomField[]>;
  forCategory(organizationId: OrganizationId): Promise<readonly EffectiveCustomField[]>;
}

/**
 * Who may read and write sensitive custom field values of the catalog (ADR-107): a caller who
 * holds `catalog.offering.update` at every location. Catalog has no separate sensitive permission.
 */
export interface SensitiveValueAccess {
  maySeeSensitive(): Promise<boolean>;
}

/** Whether a location of the active organization exists and is ACTIVE. Organization owns the Location model. */
export interface LocationLookup {
  isActiveLocation(locationId: string): Promise<boolean>;
}

/** Whether a file may be an offering or category image: it exists here, is ACTIVE, and was uploaded as OFFERING_IMAGE. */
export interface OfferingImageChecker {
  isUsableImage(fileId: string): Promise<boolean>;
}

/** The organization's value of the `catalog.defaultUnitKey` setting. */
export interface DefaultUnitReader {
  read(organizationId: OrganizationId): Promise<UnitKey>;
}

/**
 * Publishes a catalog domain event into the outbox. It must be called inside the unit of work that
 * makes the change (the kernel refuses otherwise), so the event exists exactly when the change does.
 */
export interface EventPublisher {
  publish<Type extends CatalogEventType>(
    type: Type,
    payload: EventPayloadMap[Type],
    options?: { readonly orderingKey?: string },
  ): Promise<void>;
}

/** Runs several repository calls as one all-or-nothing unit. */
export interface UnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
