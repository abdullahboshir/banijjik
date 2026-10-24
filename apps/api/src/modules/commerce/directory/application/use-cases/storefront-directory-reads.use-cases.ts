import {
  CUSTOM_FIELD_TYPE,
  type EffectiveCustomField,
  type LocalizedText,
} from "@banijjik/contracts";
import {
  LISTING_FIELD_TIER,
  type StorefrontDirectoryFormResponse,
  type StorefrontDirectoryStatsResponse,
  type StorefrontListingField,
} from "@banijjik/contracts/directory";
import type { OrganizationId } from "@banijjik/ids";
import type {
  DirectoryTemplateReader,
  DirectorySettingsReader,
  ListingFieldReader,
} from "../ports/directory-context-ports.js";
import type { ListingStatsRepository } from "../ports/listing-stats-repository.js";

const UNTRANSLATED_OPTION = (option: string): LocalizedText => ({ bn: option, en: option });

function toStorefrontField(field: EffectiveCustomField): StorefrontListingField {
  return {
    fieldKey: field.fieldKey,
    label: field.label,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    options: field.options,
    optionLabels: field.optionLabels,
    validation: field.validation,
    listingTier: field.listingTier,
    isFilterable: field.isFilterable,
    sectionKey: field.sectionKey,
    minAgeYears: field.minAgeYears,
    sortOrder: field.sortOrder,
  };
}

/**
 * The public definition of a business's directory form (M.6a decision 3). Definitions are not
 * personal data, so the read needs no sign-in: the search page needs the filter labels before it.
 */
export class GetStorefrontDirectoryFormUseCase {
  constructor(
    private readonly dependencies: {
      readonly template: DirectoryTemplateReader;
      readonly fields: ListingFieldReader;
      readonly settings: DirectorySettingsReader;
    },
  ) {}

  async execute(organizationId: OrganizationId): Promise<StorefrontDirectoryFormResponse> {
    const block = await this.dependencies.template.directoryBlockOf(organizationId);
    const fields = await this.dependencies.fields.forOrganization(organizationId);
    return {
      sections: block?.sections ?? [],
      consents: block?.consents ?? [],
      fields: fields.filter((field) => field.visibility.storefront).map(toStorefrontField),
      photoPolicy: await this.dependencies.settings.photoPolicy(organizationId),
    };
  }
}

/** The statistics field must be a PUBLIC SELECT listing field; absent tier means PUBLIC (ADR-127). */
function isPublicSelectField(field: EffectiveCustomField): boolean {
  return (
    field.fieldType === CUSTOM_FIELD_TYPE.SELECT &&
    (field.listingTier ?? LISTING_FIELD_TIER.PUBLIC) === LISTING_FIELD_TIER.PUBLIC
  );
}

/**
 * Home statistics from the pre-aggregated row only (M.6a decision 5): no listing is read here. The
 * option counts apply only when the row was computed for the field the template names now; a row
 * for another field shows zeros until the next listing event recomputes it.
 */
export class GetStorefrontDirectoryStatsUseCase {
  constructor(
    private readonly dependencies: {
      readonly stats: ListingStatsRepository;
      readonly template: DirectoryTemplateReader;
      readonly fields: ListingFieldReader;
    },
  ) {}

  async execute(organizationId: OrganizationId): Promise<StorefrontDirectoryStatsResponse> {
    const stored = await this.dependencies.stats.find(organizationId);
    const approvedCount = stored?.approvedCount ?? 0;
    const block = await this.dependencies.template.directoryBlockOf(organizationId);
    const fieldKey = block?.homeStatsFieldKey;
    if (fieldKey === undefined) return { approvedCount, field: null };
    const fields = await this.dependencies.fields.forOrganization(organizationId);
    const field = fields.find((candidate) => candidate.fieldKey === fieldKey);
    if (field === undefined || !isPublicSelectField(field)) return { approvedCount, field: null };
    const countsByOption =
      stored !== undefined && stored.fieldKey === fieldKey ? stored.countsByOption : {};
    return {
      approvedCount,
      field: {
        fieldKey,
        label: field.label,
        options: (field.options ?? []).map((option) => ({
          option,
          label: field.optionLabels?.[option] ?? UNTRANSLATED_OPTION(option),
          count: countsByOption[option] ?? 0,
        })),
      },
    };
  }
}
