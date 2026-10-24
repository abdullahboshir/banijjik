import type { CustomFieldValidationBounds } from "../custom-field/custom-field-contracts.js";
import type { CustomFieldType } from "../custom-field/custom-field-type.js";
import type { LocalizedText } from "../platform/industry-template.js";
import type { ListingFieldTier } from "./listing-field-tier.js";
import type { DirectoryPhotoPolicy } from "./directory-settings.js";
import type { DirectoryConfigResponse } from "./directory-contracts.js";

/**
 * A listing field as the public search and the listing page need it (M.6a decision 3).
 * Definitions are not personal data, so no value, rejection or report reason is included.
 */
export interface StorefrontListingField {
  readonly fieldKey: string;
  readonly label: LocalizedText;
  readonly fieldType: CustomFieldType;
  readonly isRequired: boolean;
  readonly options?: readonly string[] | undefined;
  readonly optionLabels?: Readonly<Record<string, LocalizedText>> | undefined;
  readonly validation?: CustomFieldValidationBounds | undefined;
  readonly listingTier?: ListingFieldTier | undefined;
  readonly isFilterable?: boolean | undefined;
  readonly sectionKey?: string | undefined;
  readonly minAgeYears?: number | undefined;
  readonly sortOrder: number;
}

/** Public read of the form definition of a business's directory. */
export interface StorefrontDirectoryFormResponse {
  readonly sections: DirectoryConfigResponse["sections"];
  readonly consents: DirectoryConfigResponse["consents"];
  readonly fields: readonly StorefrontListingField[];
  readonly photoPolicy: DirectoryPhotoPolicy;
}

export interface StorefrontDirectoryStatsOption {
  readonly option: string;
  readonly label: LocalizedText;
  readonly count: number;
}

/** Home statistics, read from the pre-aggregated summary (M.6a decision 5). */
export interface StorefrontDirectoryStatsResponse {
  readonly approvedCount: number;
  readonly field: {
    readonly fieldKey: string;
    readonly label: LocalizedText;
    readonly options: readonly StorefrontDirectoryStatsOption[];
  } | null;
}
