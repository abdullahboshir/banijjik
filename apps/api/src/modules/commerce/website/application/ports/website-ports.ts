import type { SitePageUpdatedPayload, WebsiteEventType } from "@banijjik/contracts/website";

/** The event bus port; the kernel publisher satisfies it. Only one payload type is emitted here. */
export interface WebsiteEventPublisher {
  publish(
    type: WebsiteEventType,
    payload: SitePageUpdatedPayload,
    options: { readonly orderingKey: string },
  ): Promise<void>;
}

/** The branding a storefront shows, read from the business (the organization module owns it). */
export interface StorefrontBusinessProfile {
  readonly organizationId: string;
  readonly name: string;
  readonly tagline: string | null;
  readonly logoFileId: string | null;
  readonly primaryColor: string | null;
  readonly accentColor: string | null;
}

/** Which storefront features the business has on. Entitlement decides; the website only reads. */
export interface StorefrontFeatureFlags {
  readonly directory: boolean;
  readonly credit: boolean;
  readonly customerLogin: boolean;
  readonly website: boolean;
}

/** The two reads behind `GET /site`, composed in routes/storefront.ts. */
export interface StorefrontSiteSources {
  readBusiness(organizationId: string): Promise<StorefrontBusinessProfile | undefined>;
  readFeatures(organizationId: string): Promise<StorefrontFeatureFlags>;
}
