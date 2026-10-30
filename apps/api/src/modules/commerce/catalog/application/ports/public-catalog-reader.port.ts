import type { OfferingKind } from "@banijjik/contracts";
import type {
  PublicCategoriesResponse,
  PublicOfferingDetailResponse,
  PublicOfferingListResponse,
  PublicOfferingsQuery,
} from "@banijjik/contracts/catalog";

/** Reader port providing public projections for storefront browse and search. */
export interface PublicCatalogReader {
  findPublicOfferings(input: {
    readonly organizationId: string;
    readonly allowedKinds: readonly OfferingKind[];
    readonly query: PublicOfferingsQuery;
  }): Promise<PublicOfferingListResponse>;

  findPublicOfferingBySlug(input: {
    readonly organizationId: string;
    readonly slug: string;
    readonly allowedKinds: readonly OfferingKind[];
    readonly locationId?: string | undefined;
  }): Promise<PublicOfferingDetailResponse | null>;

  findPublicCategories(input: {
    readonly organizationId: string;
    readonly allowedKinds: readonly OfferingKind[];
    readonly locationId?: string | undefined;
  }): Promise<PublicCategoriesResponse>;
}
