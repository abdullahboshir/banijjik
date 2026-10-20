import {
  DIRECTORY_ONE_LISTING_SETTING_KEY,
  DIRECTORY_PHOTO_POLICY,
  DIRECTORY_PHOTO_POLICY_SETTING_KEY,
  DIRECTORY_REVIEW_EDITS_SETTING_KEY,
  type DirectoryPhotoPolicy,
} from "@banijjik/contracts/directory";
import { SEQUENCE_KEY } from "@banijjik/contracts";
import type { IndustryTemplateDirectoryBlock } from "@banijjik/contracts/directory";
import { CUSTOM_FIELD_ENTITY_TYPE } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { StorageConfig } from "../../../config/index.js";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { getRequestContext } from "../../../kernel/context/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import { nextSequenceValue } from "../../../kernel/sequence/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  buildUploadFileUseCase,
  type FileStorage,
  type ReadUploadOptions,
} from "../../core/file/index.js";
import type { DirectoryDependencies } from "./application/directory-dependencies.js";
import type {
  CustomerPhoneReader,
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
  ListingUnlockReader,
} from "./application/ports/directory-context-ports.js";
import {
  ArchiveMyListingUseCase,
  GetMyListingUseCase,
  SubmitMyListingUseCase,
  UpsertMyListingUseCase,
} from "./application/use-cases/my-listing.use-cases.js";
import {
  GetPublicListingUseCase,
  SearchListingsUseCase,
} from "./application/use-cases/search-listings.use-case.js";
import {
  ApproveListingUseCase,
  GetDirectoryConfigUseCase,
  GetStaffListingUseCase,
  HideListingUseCase,
  ListDirectoryQueueUseCase,
  ListStaffListingsUseCase,
  RejectListingUseCase,
  UnhideListingUseCase,
} from "./application/use-cases/staff-listing.use-cases.js";
import { UploadListingPhotoUseCase } from "./application/use-cases/upload-listing-photo.use-case.js";
import { MongoListingRepository } from "./infrastructure/mongo-listing.repository.js";
import { buildDirectoryStorefrontRouter } from "./presentation/directory-storefront.router.js";
import { buildDirectoryTenantRouter } from "./presentation/directory-tenant.router.js";

export { directoryManifest } from "./module.manifest.js";
export { registerDirectoryModels } from "./infrastructure/register-directory-models.js";
export { MongoListingRepository } from "./infrastructure/index.js";
export type {
  CustomerPhoneReader,
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
  ListingUnlockReader,
} from "./application/ports/directory-context-ports.js";
export type { ListingRepository } from "./application/ports/listing-repository.js";
export { asListingFieldRules } from "./application/ports/directory-context-ports.js";

export interface DirectoryAdapters {
  readonly fields: ListingFieldReader;
  readonly template: DirectoryTemplateReader;
  readonly settings: DirectorySettingsReader;
  readonly phones: CustomerPhoneReader;
  readonly unlockReader: ListingUnlockReader | null;
}

export interface DirectoryTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly adapters: DirectoryAdapters;
}

export interface DirectoryStorefrontDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly adapters: DirectoryAdapters;
  readonly authenticateCustomer: RequestHandler;
  readonly authenticateCustomerOptional: RequestHandler;
  readonly storage: StorageConfig;
  readonly fileOverrides?: {
    readonly quotaBytes?: number;
    readonly uploadOptions?: ReadUploadOptions;
    readonly fileStorage?: FileStorage;
  };
}

function dependenciesOf(input: {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly adapters: DirectoryAdapters;
}): DirectoryDependencies {
  return {
    listings: new MongoListingRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    fields: input.adapters.fields,
    template: input.adapters.template,
    settings: input.adapters.settings,
    phones: input.adapters.phones,
    unlockReader: input.adapters.unlockReader,
    sequences: {
      async nextListingNumber(prefix: string): Promise<string> {
        const organizationId = asId<OrganizationId>(String(getRequestContext().organizationId));
        const n = await nextSequenceValue({
          organizationId,
          sequenceKey: SEQUENCE_KEY.LISTING,
        });
        return `${prefix}-${n}`;
      },
    },
  };
}

export function buildDirectoryTenantRouterFor(input: DirectoryTenantDependencies): Router {
  const deps = dependenciesOf(input);
  return buildDirectoryTenantRouter({
    permission: input.permission,
    getConfig: new GetDirectoryConfigUseCase(deps),
    listQueue: new ListDirectoryQueueUseCase(deps),
    listListings: new ListStaffListingsUseCase(deps),
    getListing: new GetStaffListingUseCase(deps),
    approve: new ApproveListingUseCase(deps),
    reject: new RejectListingUseCase(deps),
    hide: new HideListingUseCase(deps),
    unhide: new UnhideListingUseCase(deps),
  });
}

export function buildDirectoryStorefrontRouterFor(input: DirectoryStorefrontDependencies): Router {
  const deps = dependenciesOf(input);
  const uploadFile = buildUploadFileUseCase({
    clock: input.clock,
    storage: input.storage,
    overrides: input.fileOverrides,
  });
  return buildDirectoryStorefrontRouter({
    getMyListing: new GetMyListingUseCase(deps),
    upsertMyListing: new UpsertMyListingUseCase(deps),
    submitMyListing: new SubmitMyListingUseCase(deps),
    archiveMyListing: new ArchiveMyListingUseCase(deps),
    uploadListingPhoto: new UploadListingPhotoUseCase(deps, uploadFile),
    searchListings: new SearchListingsUseCase(deps),
    getPublicListing: new GetPublicListingUseCase(deps),
    limiter: input.limiter,
    authenticateCustomer: input.authenticateCustomer,
    authenticateCustomerOptional: input.authenticateCustomerOptional,
    ...(input.fileOverrides?.uploadOptions === undefined
      ? {}
      : { uploadOptions: input.fileOverrides.uploadOptions }),
  });
}

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
