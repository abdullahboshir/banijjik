import type { ListingStatus } from "./listing-status.js";

export const LISTING_REJECTION_NOTE_MAX_LENGTH = 500;
export const LISTING_NUMBER_PREFIX_MAX_LENGTH = 12;
export const DIRECTORY_SECTION_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const DIRECTORY_CONSENT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const DIRECTORY_REASON_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export const DIRECTORY_API_MESSAGE_KEYS = {
  listingNotFound: "errors.directory_listing_not_found",
  listingConflict: "errors.directory_listing_conflict",
  oneListingPerAccount: "errors.directory_one_listing_per_account",
  finalRejection: "errors.directory_final_rejection",
  photoPolicyNone: "errors.directory_photo_policy_none",
  invalidTransition: "errors.directory_invalid_transition",
  underMinAge: "errors.directory_under_min_age",
  phoneMustDiffer: "errors.directory_phone_must_differ",
  consentRequired: "errors.directory_consent_required",
  filterNotAllowed: "errors.directory_filter_not_allowed",
  reportNotConfigured: "errors.directory_report_not_configured",
  reportOwnListing: "errors.directory_report_own_listing",
  reportUnknownReason: "errors.directory_report_unknown_reason",
  reportDailyLimit: "errors.directory_report_daily_limit",
  reportStale: "errors.directory_report_stale",
  reportCannotHide: "errors.directory_report_cannot_hide",
  blockOwnListing: "errors.directory_block_own_listing",
  blockAccountLimit: "errors.directory_block_account_limit",
} as const;

/** Message keys the directory endpoints can send. Both i18n catalogs need each. */
export const DIRECTORY_API_MESSAGE_KEY_LIST: readonly string[] = Object.values(
  DIRECTORY_API_MESSAGE_KEYS,
);

export interface ListingConsentAccepted {
  readonly consentKey: string;
  readonly textVersionHash: string;
  readonly acceptedAt: string;
}

export interface ListingRejection {
  readonly reasonKeys: readonly string[];
  readonly note?: string | undefined;
}

/** Staff and owner responses carry every tier; public/member responses are already projected. */
export interface ListingResponse {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: string;
  readonly status: ListingStatus;
  readonly customFields: Record<string, unknown>;
  readonly photoFileIds: readonly string[];
  readonly consentsAccepted: readonly ListingConsentAccepted[];
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly reviewedByUserId: string | null;
  readonly rejection: ListingRejection | null;
  readonly publishedAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListingListItem {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly customFields: Record<string, unknown>;
  readonly photoFileIds: readonly string[];
  readonly publishedAt: string;
}

/** Template `directory` block for staff screens (card M.3, ADR-129). No listingNumberPrefix. */
export interface DirectoryConfigResponse {
  readonly sections: readonly {
    readonly sectionKey: string;
    readonly label: { readonly bn: string; readonly en: string };
  }[];
  readonly rejectionReasons: readonly {
    readonly reasonKey: string;
    readonly label: { readonly bn: string; readonly en: string };
    readonly isFinal: boolean;
  }[];
  readonly consents: readonly {
    readonly consentKey: string;
    readonly text: { readonly bn: string; readonly en: string };
  }[];
  /** Template report reasons (M.7 decision 1); empty when the template configures none. */
  readonly reportReasons: readonly {
    readonly reasonKey: string;
    readonly label: { readonly bn: string; readonly en: string };
  }[];
}

/**
 * Staff all-listings row: first section PUBLIC fields only; never PRIVATE or UNLOCKED (ADR-129).
 * `editedAfterApproval` is true when the listing is SUBMITTED after a prior review (reviewedAt set).
 */
export interface StaffListingListItem {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly status: ListingStatus;
  readonly submittedAt: string | null;
  readonly publishedAt: string | null;
  readonly editedAfterApproval: boolean;
  readonly customFields: Record<string, unknown>;
}

export interface ListingUpsertRequest {
  readonly customFields?: Record<string, unknown>;
  readonly photoFileIds?: readonly string[];
  readonly version?: number;
}

export interface ListingSubmitRequest {
  readonly consents: readonly { readonly consentKey: string }[];
}

export interface ListingRejectRequest {
  readonly reasonKeys: readonly string[];
  readonly note?: string;
  readonly version: number;
}

export interface ListingTransitionRequest {
  readonly version: number;
}

export interface ListingEventPayload {
  readonly listingId: string;
  readonly listingNumber: string;
  readonly ownerCustomerAccountId: string;
  readonly status: ListingStatus;
}
