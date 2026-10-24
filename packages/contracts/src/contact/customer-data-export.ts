import { defineEnum } from "../define-enum.js";
import type { ContactAddress } from "./contact-contracts.js";

export const CUSTOMER_DATA_EXPORT_SECTION_KEY = defineEnum([
  "LISTING",
  "DIRECTORY_ACTIVITY",
  "CREDIT",
]);
export type CustomerDataExportSectionKey =
  (typeof CUSTOMER_DATA_EXPORT_SECTION_KEY)[keyof typeof CUSTOMER_DATA_EXPORT_SECTION_KEY];

export const CUSTOMER_DATA_EXPORT_MAX_ROWS = 1000;

export const CUSTOMER_DATA_EXPORT_RULES = {
  maxExportsPerDay: 3,
  maxRows: CUSTOMER_DATA_EXPORT_MAX_ROWS,
  windowSeconds: 86400,
} as const;

export interface CustomerErasureParticipant {
  /** Inside the erase transaction. Idempotent: a second call finds nothing to do. */
  eraseForAccount(input: {
    organizationId: string;
    customerAccountId: string;
    now: Date;
  }): Promise<{ forfeitedCredits?: number } | void>;
}

export interface CustomerDataExportParticipant {
  readonly sectionKey: CustomerDataExportSectionKey;
  exportForAccount(input: {
    organizationId: string;
    customerAccountId: string;
    maxRows: number;
  }): Promise<CustomerDataExportSection>;
}

export interface ListingExportSection {
  readonly sectionKey: "LISTING";
  readonly listing: Record<string, unknown> | null;
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

export type CustomerDataExportSection =
  ListingExportSection | DirectoryActivityExportSection | CreditExportSection;

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

export interface CustomerDataExportResponse {
  readonly exportedAt: string;
  readonly account: CustomerAccountExportData;
  readonly contact: CustomerContactExportData | null;
  readonly listing: ListingExportSection;
  readonly directoryActivity: DirectoryActivityExportSection;
  readonly credit: CreditExportSection;
  readonly sections: Record<CustomerDataExportSectionKey, CustomerDataExportSection>;
}
