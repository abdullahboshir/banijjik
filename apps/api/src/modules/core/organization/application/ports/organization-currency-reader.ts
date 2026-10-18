import type { CurrencyCode } from "@banijjik/contracts";

/**
 * The currency of an organization. It is fixed at signup, so a reader may ask once per request.
 * Other modules (catalog, card 3.2a) get it through their own port, adapted in routes.
 */
export interface OrganizationCurrencyReader {
  read(organizationId: string): Promise<CurrencyCode | undefined>;
}
