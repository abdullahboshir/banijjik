import { MODULE_KEY, type ModuleManifest } from "@banijjik/contracts";
import { asId, type ListingId } from "@banijjik/ids";
import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildDirectoryTenantRouterFor,
  directorySettingsFromResolver,
  listingFieldsFromEffectiveReader,
  type ListingUnlockCounter,
} from "../modules/commerce/directory/index.js";
import { buildCustomerPhoneReader } from "../modules/commerce/contact/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildDirectoryBlockReader } from "../modules/platform/industry/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { MongoListingUnlockRepository } from "../modules/commerce/credit/index.js";

/** Counts unlock rows only when the credit module is effective for the request's organization. */
function buildUnlockCounter(orgConfig: OrgConfigService): ListingUnlockCounter {
  const unlocks = new MongoListingUnlockRepository();
  return {
    async countByListing(listingId) {
      const { organizationId } = getRequestContext();
      if (organizationId === undefined) return null;
      if (!(await orgConfig.isModuleEffective(organizationId, MODULE_KEY.CREDIT))) return null;
      return unlocks.countByListing(asId<ListingId>(listingId));
    },
  };
}

export interface DirectoryRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

export function buildDirectoryTenantRouter(input: DirectoryRouterInput): Router {
  const settingsResolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return buildDirectoryTenantRouterFor({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    adapters: {
      fields: listingFieldsFromEffectiveReader(buildEffectiveCustomFieldReader()),
      settings: directorySettingsFromResolver(settingsResolver),
      template: buildDirectoryBlockReader(),
      phones: buildCustomerPhoneReader(),
      unlockReader: null,
      unlockCounter: buildUnlockCounter(input.orgConfig),
    },
  });
}
