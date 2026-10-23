import type { LocationId, OfferingId, OrganizationId } from "@banijjik/ids";

/** A3 folds this narrow session reader into the shared kind-keyed reader. */
export interface EventSessionOfferingReader {
  readEventOffering(input: {
    readonly organizationId: OrganizationId;
    readonly offeringId: OfferingId;
    readonly variantId: string;
    readonly locationId: LocationId;
  }): Promise<
    | {
        readonly offeringId: OfferingId;
        readonly variantId: string;
        readonly name: string;
      }
    | undefined
  >;
}
