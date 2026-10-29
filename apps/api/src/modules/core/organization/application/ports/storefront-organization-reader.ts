import type { PreferredLocale } from "@banijjik/contracts";

/** What the public site needs to know about a business: who it is and in which language it speaks. */
export interface StorefrontOrganization {
  readonly organizationId: string;
  readonly slug: string;
  readonly name: string;
  readonly defaultLocale: PreferredLocale;
  /** Keys the resolved-config cache; the storefront puts it into the request context like tenantContext does. */
  readonly configVersion: number;
  /** The branding the public site shows; null where the business has not set it (card 3.12). */
  readonly tagline: string | null;
  readonly logoFileId: string | null;
  readonly primaryColor: string | null;
  readonly accentColor: string | null;
}

/**
 * Finds an ACTIVE business without a session, for the public storefront (card M.1). A suspended or
 * closed business is simply not found. The organization is platform data, so no tenant context is needed.
 */
export interface StorefrontOrganizationReader {
  findActiveBySlug(slug: string): Promise<StorefrontOrganization | undefined>;
  findActiveById(organizationId: string): Promise<StorefrontOrganization | undefined>;
}
