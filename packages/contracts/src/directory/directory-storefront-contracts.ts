import type { EffectiveCustomField } from "../custom-field/custom-field-contracts.js";
import type { LocalizedText } from "../platform/industry-template.js";
import type { DirectoryPhotoPolicy } from "./directory-settings.js";
import type { DirectoryConfigResponse } from "./directory-contracts.js";

/**
 * A listing field as the public search and the listing page need it (M.6a decision 3).
 * Definitions are not personal data, so no value, rejection or report reason is included.
 */
export type StorefrontListingField = Pick<
  EffectiveCustomField,
  | "fieldKey"
  | "label"
  | "fieldType"
  | "isRequired"
  | "options"
  | "optionLabels"
  | "validation"
  | "listingTier"
  | "isFilterable"
  | "sectionKey"
  | "minAgeYears"
  | "sortOrder"
>;

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
