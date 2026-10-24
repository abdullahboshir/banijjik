import type {
  DirectoryPhotoPolicy,
  IndustryTemplateDirectoryBlock,
} from "@banijjik/contracts/directory";
import {
  DIRECTORY_PHOTO_POLICY,
  DIRECTORY_PHOTO_POLICY_SETTING_KEY,
  DIRECTORY_REVIEW_EDITS_SETTING_KEY,
  DIRECTORY_ONE_LISTING_SETTING_KEY,
} from "@banijjik/contracts/directory";
import { CUSTOM_FIELD_ENTITY_TYPE } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type {
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
} from "./application/ports/directory-context-ports.js";

/** Settings adapter over the settings resolver. */
export function directorySettingsFromResolver(resolve: {
  resolve(
    organizationId: OrganizationId,
    options: { keys: readonly string[] },
  ): Promise<ReadonlyMap<string, { value: unknown }>>;
}): DirectorySettingsReader {
  return {
    async oneListingPerAccount(organizationId) {
      const map = await resolve.resolve(organizationId, {
        keys: [DIRECTORY_ONE_LISTING_SETTING_KEY],
      });
      return map.get(DIRECTORY_ONE_LISTING_SETTING_KEY)?.value !== false;
    },
    async reviewEdits(organizationId) {
      const map = await resolve.resolve(organizationId, {
        keys: [DIRECTORY_REVIEW_EDITS_SETTING_KEY],
      });
      return map.get(DIRECTORY_REVIEW_EDITS_SETTING_KEY)?.value !== false;
    },
    async photoPolicy(organizationId) {
      const map = await resolve.resolve(organizationId, {
        keys: [DIRECTORY_PHOTO_POLICY_SETTING_KEY],
      });
      const value = map.get(DIRECTORY_PHOTO_POLICY_SETTING_KEY)?.value;
      if (
        value === DIRECTORY_PHOTO_POLICY.BLURRED_PUBLIC ||
        value === DIRECTORY_PHOTO_POLICY.UNLOCKED_ONLY ||
        value === DIRECTORY_PHOTO_POLICY.NONE
      ) {
        return value as DirectoryPhotoPolicy;
      }
      return DIRECTORY_PHOTO_POLICY.NONE;
    },
  };
}

export function listingFieldsFromEffectiveReader(reader: {
  forEntity(
    organizationId: OrganizationId,
    entityType: typeof CUSTOM_FIELD_ENTITY_TYPE.listing,
  ): Promise<readonly import("@banijjik/contracts").EffectiveCustomField[]>;
}): ListingFieldReader {
  return {
    forOrganization(organizationId) {
      return reader.forEntity(organizationId, CUSTOM_FIELD_ENTITY_TYPE.listing);
    },
  };
}

export function directoryTemplateFromIndustryReader(reader: {
  forOrganization(organizationId: OrganizationId): Promise<
    | {
        directory?: IndustryTemplateDirectoryBlock | undefined;
      }
    | {
        readonly configuration: {
          directory?: IndustryTemplateDirectoryBlock | undefined;
        };
      }
  >;
}): DirectoryTemplateReader {
  return {
    async directoryBlockOf(organizationId) {
      const row = await reader.forOrganization(organizationId);
      if ("configuration" in row) return row.configuration.directory;
      return row.directory;
    },
  };
}
