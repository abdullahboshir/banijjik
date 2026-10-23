import type { CurrencyCode } from "@banijjik/contracts";
import type { StoreCreditEntryResponse } from "@banijjik/contracts/payment";
import type { DisplayLocale } from "@banijjik/ui";
import type { StoreCreditLabels } from "./store-credit-labels";

export interface StoreCreditProps {
  organizationId: string;
  contactId: string;
  balanceMinor: number;
  currency: CurrencyCode;
  entries: readonly StoreCreditEntryResponse[];
  total: number;
  canAdjust: boolean;
  locations: readonly { locationId: string; name: string }[];
  locale: DisplayLocale;
  timeZone: string;
  labels: StoreCreditLabels;
}
