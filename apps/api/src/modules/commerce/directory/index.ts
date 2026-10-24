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
import { kernelEventPublisher, registerEventHandler } from "../../../kernel/events/index.js";
import { nextSequenceValue } from "../../../kernel/sequence/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import {
  buildUploadFileUseCase,
  type FileStorage,
  type ReadUploadOptions,
} from "../../core/file/index.js";
import type {
  DirectoryDependencies,
  DirectoryStaffDependencies,
} from "./application/directory-dependencies.js";
import type {
  CustomerAccountBlocker,
  CustomerPhoneReader,
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
  ListingModerationAccess,
  ListingUnlockCounter,
  ListingUnlockReader,
  OrganizationTimezoneSource,
} from "./application/ports/directory-context-ports.js";
import { buildHideOnAccountBlockedHandler } from "./application/handlers/hide-on-account-blocked.handler.js";
import { CountListingUnlocksUseCase } from "./application/use-cases/count-listing-unlocks.use-case.js";
import {
  FileListingReportUseCase,
  GetListingReportReasonsUseCase,
  ListListingReportQueueUseCase,
  ListListingReportsUseCase,
  ResolveListingReportsUseCase,
} from "./application/use-cases/listing-report.use-cases.js";
import {
  BlockListingUseCase,
  ListMyListingBlocksUseCase,
  UnblockListingUseCase,
} from "./application/use-cases/listing-block.use-cases.js";
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
import { MongoListingReportRepository } from "./infrastructure/mongo-listing-report.repository.js";
import { MongoListingBlockRepository } from "./infrastructure/mongo-listing-block.repository.js";
import { buildDirectoryStorefrontRouter } from "./presentation/directory-storefront.router.js";
import { buildDirectoryTenantRouter } from "./presentation/directory-tenant.router.js";

export { directoryManifest } from "./module.manifest.js";
export { registerDirectoryModels } from "./infrastructure/register-directory-models.js";
export { MongoListingRepository } from "./infrastructure/index.js";
export {
  buildDirectoryErasureParticipant,
  buildDirectoryExportParticipants,
} from "./application/directory-erasure-participants.js";
export type {
  CustomerAccountBlocker,
  CustomerPhoneReader,
  DirectorySettingsReader,
  DirectoryTemplateReader,
  ListingFieldReader,
  ListingModerationAccess,
  ListingUnlockCounter,
  ListingUnlockReader,
  OrganizationTimezoneSource,
} from "./application/ports/directory-context-ports.js";
export type { ListingRepository } from "./application/ports/listing-repository.js";
export type { Listing } from "./domain/listing.entity.js";
export { asListingFieldRules } from "./application/ports/directory-context-ports.js";
export { projectListingFields } from "./domain/project-listing.js";

export interface DirectoryAdapters {
  readonly fields: ListingFieldReader;
  readonly template: DirectoryTemplateReader;
  readonly settings: DirectorySettingsReader;
  readonly phones: CustomerPhoneReader;
  readonly unlockReader: ListingUnlockReader | null;
  readonly unlockCounter: ListingUnlockCounter | null;
  /** The business day of the report cap is the organization's, not UTC (M.7 decision 3). */
  readonly timezones: OrganizationTimezoneSource;
}

export interface DirectoryTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly adapters: DirectoryAdapters;
  /** The second permission of a resolve, read from the permission gate (M.7 decision 6). */
  readonly moderationAccess: ListingModerationAccess;
  /** Bans the listing owner's customer account (M.7 decision 7). */
  readonly accountBlocker: CustomerAccountBlocker;
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
    reports: new MongoListingReportRepository(),
    blocks: new MongoListingBlockRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: input.audit,
    clock: input.clock,
    fields: input.adapters.fields,
    template: input.adapters.template,
    settings: input.adapters.settings,
    phones: input.adapters.phones,
    unlockReader: input.adapters.unlockReader,
    unlockCounter: input.adapters.unlockCounter,
    timezones: input.adapters.timezones,
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
  const staff: DirectoryStaffDependencies = {
    ...dependenciesOf(input),
    moderationAccess: input.moderationAccess,
    accountBlocker: input.accountBlocker,
  };
  return buildDirectoryTenantRouter({
    permission: input.permission,
    getConfig: new GetDirectoryConfigUseCase(staff),
    listQueue: new ListDirectoryQueueUseCase(staff),
    listListings: new ListStaffListingsUseCase(staff),
    getListing: new GetStaffListingUseCase(staff),
    approve: new ApproveListingUseCase(staff),
    reject: new RejectListingUseCase(staff),
    hide: new HideListingUseCase(staff),
    unhide: new UnhideListingUseCase(staff),
    countUnlocks: new CountListingUnlocksUseCase(staff),
    reportQueue: new ListListingReportQueueUseCase(staff),
    listReports: new ListListingReportsUseCase(staff),
    resolveReports: new ResolveListingReportsUseCase(staff),
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
    fileReport: new FileListingReportUseCase(deps),
    reportReasons: new GetListingReportReasonsUseCase(deps),
    blockListing: new BlockListingUseCase(deps),
    unblockListing: new UnblockListingUseCase(deps),
    listMyListingBlocks: new ListMyListingBlocksUseCase(deps),
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

/**
 * Registers the directory event handlers. The worker calls it before it starts (ADR-090); the
 * handler needs only the listing write ports, so no other module's adapter is involved.
 */
export function registerDirectoryEventHandlers(dependencies: {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}): void {
  registerEventHandler(
    buildHideOnAccountBlockedHandler({
      listings: new MongoListingRepository(),
      unitOfWork: new MongoUnitOfWork(),
      events: kernelEventPublisher,
      audit: dependencies.audit,
      clock: dependencies.clock,
    }),
  );
}
