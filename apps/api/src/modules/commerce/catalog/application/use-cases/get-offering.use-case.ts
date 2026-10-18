import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { OfferingId, OrganizationId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import type { CatalogDependencies } from "../catalog-dependencies.js";
import { viewOffering } from "../offering-view.js";

export type GetOfferingDependencies = Pick<
  CatalogDependencies,
  "offerings" | "categories" | "modifierGroups" | "customFields" | "sensitiveAccess"
>;

/** The full offering. One of another organization is simply not found. */
export class GetOfferingUseCase {
  constructor(private readonly dependencies: GetOfferingDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly offeringId: OfferingId;
  }): Promise<OfferingResponse> {
    const { offerings, customFields } = this.dependencies;
    const offering = await offerings.findById(input.offeringId);
    if (offering === undefined) throw recordNotFound();
    const fields = await customFields.forOffering(input.organizationId, offering.kind);
    return viewOffering(this.dependencies, offering, fields);
  }
}
