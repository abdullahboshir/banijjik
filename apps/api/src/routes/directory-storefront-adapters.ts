import { MODULE_KEY, type ModuleManifest } from "@banijjik/contracts";
import { getRequestContext } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  directorySettingsFromResolver,
  listingFieldsFromEffectiveReader,
  type DirectoryAdapters,
  type ListingUnlockReader,
} from "../modules/commerce/directory/index.js";
import { buildCustomerPhoneReader } from "../modules/commerce/contact/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildDirectoryBlockReader } from "../modules/platform/industry/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  CreditListingUnlockReader,
  MongoListingUnlockRepository,
} from "../modules/commerce/credit/index.js";

/** The unlock view is gated per organization: with the credit module off it stays hidden (M.4). */
function buildCreditGatedUnlockReader(orgConfig: OrgConfigService): ListingUnlockReader {
  const reader = new CreditListingUnlockReader(new MongoListingUnlockRepository());
  const isCreditEnabled = async (): Promise<boolean> => {
    const { organizationId } = getRequestContext();
    if (organizationId === undefined) return false;
    return orgConfig.isModuleEffective(organizationId, MODULE_KEY.CREDIT);
  };
  return {
    async hasUnlocked(listingId, customerAccountId) {
      return (await isCreditEnabled()) && reader.hasUnlocked(listingId, customerAccountId);
    },
    async unlockedListingIds(customerAccountId, listingIds) {
      if (!(await isCreditEnabled())) return new Set();
      return reader.unlockedListingIds(customerAccountId, listingIds);
    },
  };
}

export function buildDirectoryAdapters(input: {
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly clock: Clock;
}): DirectoryAdapters {
  void input.clock;
  const settingsResolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });

  return {
    fields: listingFieldsFromEffectiveReader(buildEffectiveCustomFieldReader()),
    settings: directorySettingsFromResolver(settingsResolver),
    template: buildDirectoryBlockReader(),
    phones: buildCustomerPhoneReader(),
    unlockReader: buildCreditGatedUnlockReader(input.orgConfig),
    unlockCounter: null,
  };
}
