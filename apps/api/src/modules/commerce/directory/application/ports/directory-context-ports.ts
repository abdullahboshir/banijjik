import type { EffectiveCustomField } from "@banijjik/contracts";
import type { IndustryTemplateDirectoryBlock } from "@banijjik/contracts/directory";
import type { DirectoryPhotoPolicy } from "@banijjik/contracts/directory";
import type { OrganizationId } from "@banijjik/ids";
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
}

export interface CustomerPhoneReader {
  phoneOf(customerAccountId: string): Promise<string | undefined>;
}

export interface ListingSequence {
  nextListingNumber(prefix: string): Promise<string>;
}

export interface ListingUnlockReader {
  hasUnlocked(listingId: string, customerAccountId: string): Promise<boolean>;
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
