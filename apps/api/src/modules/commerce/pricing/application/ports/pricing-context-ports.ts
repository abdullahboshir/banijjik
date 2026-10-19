import type { CurrencyCode } from "@banijjik/contracts";
import type { PricingRounding } from "@banijjik/contracts/pricing";
import type { OrganizationId } from "@banijjik/ids";
import type { CatalogQuoteReader } from "../../../catalog/index.js";

export interface OrganizationPricingContext {
  read(organizationId: OrganizationId): Promise<{ readonly currency: CurrencyCode }>;
}

export interface PricingSettingsReader {
  read(organizationId: OrganizationId): Promise<{
    readonly taxInclusive: boolean;
    readonly rounding: PricingRounding;
    readonly approvalPercentAbove: number;
    readonly approvalAmountAbove: number;
    readonly defaultTaxClassKey: string;
  }>;
}

export interface LocationReachChecker {
  mayReach(locationId: string): Promise<boolean>;
}

export type { CatalogQuoteReader };
