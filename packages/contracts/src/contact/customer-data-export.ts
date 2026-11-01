import { defineEnum } from "../define-enum.js";
import type { ListingResponse } from "../directory/directory-contracts.js";
import type { Money } from "../pricing/pricing-contracts.js";
import type { ContactAddress } from "./contact-contracts.js";

export const CUSTOMER_DATA_EXPORT_SECTION_KEY = defineEnum([
  "LISTING",
  "DIRECTORY_ACTIVITY",
  "CREDIT",
  "CHECKOUT",
]);
export type CustomerDataExportSectionKey =
  (typeof CUSTOMER_DATA_EXPORT_SECTION_KEY)[keyof typeof CUSTOMER_DATA_EXPORT_SECTION_KEY];

export const CUSTOMER_DATA_EXPORT_MAX_ROWS = 1000;

export const CUSTOMER_DATA_EXPORT_RULES = {
  maxExportsPerDay: 3,
  maxRows: CUSTOMER_DATA_EXPORT_MAX_ROWS,
  windowSeconds: 86400,
} as const;

export interface ListingExportSection {
  readonly sectionKey: "LISTING";
  readonly listing: ListingResponse | null;
  readonly truncated: boolean;
}

export interface DirectoryActivityExportSection {
  readonly sectionKey: "DIRECTORY_ACTIVITY";
  readonly blocks: readonly {
    readonly listingBlockId: string;
    readonly listingId: string;
    readonly listingNumber: string;
    readonly createdAt: string;
  }[];
  readonly blocksTruncated: boolean;
  readonly reports: readonly {
    readonly listingReportId: string;
    readonly listingId: string;
    readonly reasonKey: string;
    readonly note: string | null;
    readonly status: string;
    readonly outcome: string | null;
    readonly createdAt: string;
    readonly resolvedAt: string | null;
  }[];
  readonly reportsTruncated: boolean;
  readonly truncated: boolean;
}

export interface CreditEntryExportItem {
  readonly creditEntryId: string;
  readonly type: string;
  readonly credits: number;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface UnlockExportItem {
  readonly listingUnlockId: string;
  readonly listingId: string;
  readonly unlockedAt: string;
}

export interface CreditPurchaseExportItem {
  readonly creditPurchaseId: string;
  readonly creditPackId: string;
  readonly status: string;
  readonly createdAt: string;
}

export interface CreditExportSection {
  readonly sectionKey: "CREDIT";
  readonly balance: number;
  readonly entries: readonly CreditEntryExportItem[];
  readonly entriesTruncated: boolean;
  readonly unlocks: readonly UnlockExportItem[];
  readonly unlocksTruncated: boolean;
  readonly purchases: readonly CreditPurchaseExportItem[];
  readonly purchasesTruncated: boolean;
  readonly truncated: boolean;
}

export interface CheckoutExportRequestItem {
  readonly checkoutRequestLinkId: string;
  readonly selectionIds: readonly string[];
  readonly requestType: "ORDER" | "BOOKING" | "ENROLLMENT";
  readonly requestId: string;
  readonly publicNumber: string | null;
  readonly status: string;
  readonly paymentRequired: Money;
  readonly holdExpiresAt: string | null;
}

export interface CheckoutExportItem {
  readonly checkoutId: string;
  readonly locationId: string;
  readonly quoteId: string;
  readonly total: Money;
  readonly contactSnapshot: {
    readonly name: string;
    readonly phoneE164: string;
    readonly customFields: Readonly<Record<string, unknown>>;
  };
  readonly requests: readonly CheckoutExportRequestItem[];
  readonly createdAt: string;
}

export interface CheckoutExportSection {
  readonly sectionKey: "CHECKOUT";
  readonly checkouts: readonly CheckoutExportItem[];
  readonly truncated: boolean;
}

export type CustomerDataExportSection =
  | ListingExportSection
  | DirectoryActivityExportSection
  | CreditExportSection
  | CheckoutExportSection;

export interface CustomerAccountExportData {
  readonly customerAccountId: string;
  readonly phoneE164: string;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface CustomerContactExportData {
  readonly contactId: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly phoneE164: string | null;
  readonly additionalPhonesE164: readonly string[];
  readonly addresses: readonly ContactAddress[];
  readonly customFields: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CustomerDataExportSections {
  readonly LISTING: ListingExportSection;
  readonly DIRECTORY_ACTIVITY: DirectoryActivityExportSection;
  readonly CREDIT: CreditExportSection;
  readonly CHECKOUT?: CheckoutExportSection;
}

export interface CustomerDataExportResponse {
  readonly exportedAt: string;
  readonly account: CustomerAccountExportData;
  readonly contact: CustomerContactExportData | null;
  readonly sections: CustomerDataExportSections;
}
