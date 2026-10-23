import { MODULE_KEY, PERMISSION_KEY, type ModuleManifest } from "@banijjik/contracts";
import { asId, type ListingId } from "@banijjik/ids";
import type { Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildDirectoryTenantRouterFor,
  directorySettingsFromResolver,
  listingFieldsFromEffectiveReader,
  type ListingModerationAccess,
  type ListingUnlockCounter,
} from "../modules/commerce/directory/index.js";
import {
  buildCustomerAccountBlocker,
  buildCustomerPhoneReader,
} from "../modules/commerce/contact/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildOrganizationTimezoneReader } from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildDirectoryBlockReader } from "../modules/platform/industry/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { MongoListingUnlockRepository } from "../modules/commerce/credit/index.js";

/**
 * The second permission of a resolve, asked by key (M.7 decision 6): the staff member must hold
 * directory.listing.hide or contact.customerAccount.block at every location, like sensitive values
 * in catalog (ADR-107). Rules never name a role.
 */
function moderationAccessOf(
  permissions: Pick<PermissionGate, "locationsWith">,
): ListingModerationAccess {
  return {
    async mayHide() {
      return (await permissions.locationsWith(PERMISSION_KEY.DIRECTORY_LISTING_HIDE)) === "ALL";
    },
    async mayBlockAccounts() {
      return (
        (await permissions.locationsWith(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK)) === "ALL"
      );
    },
  };
}

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
  readonly permissions: Pick<PermissionGate, "locationsWith">;
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
    moderationAccess: moderationAccessOf(input.permissions),
    accountBlocker: buildCustomerAccountBlocker({ clock: input.clock, audit: input.audit }),
    adapters: {
      fields: listingFieldsFromEffectiveReader(buildEffectiveCustomFieldReader()),
      settings: directorySettingsFromResolver(settingsResolver),
      template: buildDirectoryBlockReader(),
      phones: buildCustomerPhoneReader(),
      unlockReader: null,
      unlockCounter: buildUnlockCounter(input.orgConfig),
      timezones: buildOrganizationTimezoneReader(),
    },
  });
}
