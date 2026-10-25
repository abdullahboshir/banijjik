import type { EffectiveCustomField } from "@banijjik/contracts";
import type { IndustryTemplateDirectoryBlock } from "@banijjik/contracts/directory";
import type { DirectoryPhotoPolicy } from "@banijjik/contracts/directory";
import type { CustomerAccountId, OrganizationId, UserId } from "@banijjik/ids";
import type { CustomFieldRule } from "@banijjik/validation";

export interface ListingFieldReader {
  forOrganization(organizationId: OrganizationId): Promise<readonly EffectiveCustomField[]>;
}

export interface DirectoryTemplateReader {
  directoryBlockOf(
    organizationId: OrganizationId,
  ): Promise<IndustryTemplateDirectoryBlock | undefined>;
}

export interface DirectorySettingsReader {
  oneListingPerAccount(organizationId: OrganizationId): Promise<boolean>;
  reviewEdits(organizationId: OrganizationId): Promise<boolean>;
  photoPolicy(organizationId: OrganizationId): Promise<DirectoryPhotoPolicy>;
  /** One SMS per review result while it is on (M.8b). */
  notifyReviewBySms(organizationId: OrganizationId): Promise<boolean>;
}

export interface CustomerPhoneReader {
  phoneOf(customerAccountId: string): Promise<string | undefined>;
}

export interface ListingSequence {
  nextListingNumber(prefix: string): Promise<string>;
}

export interface ListingUnlockReader {
  hasUnlocked(listingId: string, customerAccountId: string): Promise<boolean>;
  /** One query for a page of results, so listing lists never ask per row. */
  unlockedListingIds(
    customerAccountId: string,
    listingIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
}

/** Count-only privacy (M.4 decision 6): never who unlocked. Null when the credit module is off. */
export interface ListingUnlockCounter {
  countByListing(listingId: string): Promise<number | null>;
}

/** The second permission of a resolve, asked by permission key, never by role (M.7 decision 6). */
export interface ListingModerationAccess {
  mayHide(): Promise<boolean>;
  mayBlockAccounts(): Promise<boolean>;
}

/** Blocks the customer account behind a listing; reuses the existing contact block path (M.7 decision 7). */
export interface CustomerAccountBlocker {
  block(input: {
    readonly organizationId: OrganizationId;
    readonly customerAccountId: CustomerAccountId;
    readonly actorUserId: UserId;
  }): Promise<void>;
}

/** The organization timezone, for the business day of the report daily cap (M.7 decision 3). */
export interface OrganizationTimezoneSource {
  read(organizationId: OrganizationId): Promise<string | undefined>;
}

export function asListingFieldRules(
  fields: readonly EffectiveCustomField[],
): readonly CustomFieldRule[] {
  return fields.map((field) => ({
    fieldKey: field.fieldKey,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    visibility: field.visibility,
    isSensitive: field.isSensitive,
    isSearchable: field.isSearchable,
    ...(field.options === undefined ? {} : { options: field.options }),
    ...(field.validation === undefined ? {} : { validation: field.validation }),
    ...(field.listingTier === undefined ? {} : { listingTier: field.listingTier }),
    ...(field.isFilterable === undefined ? {} : { isFilterable: field.isFilterable }),
    ...(field.sectionKey === undefined ? {} : { sectionKey: field.sectionKey }),
    ...(field.minAgeYears === undefined ? {} : { minAgeYears: field.minAgeYears }),
    ...(field.mustDifferFromAccountPhone === undefined
      ? {}
      : { mustDifferFromAccountPhone: field.mustDifferFromAccountPhone }),
  }));
}
