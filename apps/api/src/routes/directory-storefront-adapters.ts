import type { ModuleManifest } from "@banijjik/contracts";
import type { Clock } from "../kernel/time/index.js";
import {
  directorySettingsFromResolver,
  listingFieldsFromEffectiveReader,
  type DirectoryAdapters,
} from "../modules/commerce/directory/index.js";
import { buildCustomerPhoneReader } from "../modules/commerce/contact/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildDirectoryBlockReader } from "../modules/platform/industry/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { CreditListingUnlockReader } from "../modules/commerce/credit/index.js";
import { MongoListingUnlockRepository } from "../modules/commerce/credit/index.js";
import { MODULE_KEY } from "@banijjik/contracts";

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

  const creditEnabled = input.manifests.some((m) => m.key === MODULE_KEY.CREDIT);
  const unlockReader = creditEnabled
    ? new CreditListingUnlockReader(new MongoListingUnlockRepository())
    : null;

  return {
    fields: listingFieldsFromEffectiveReader(buildEffectiveCustomFieldReader()),
    settings: directorySettingsFromResolver(settingsResolver),
    template: buildDirectoryBlockReader(),
    phones: buildCustomerPhoneReader(),
    unlockReader,
  };
}
