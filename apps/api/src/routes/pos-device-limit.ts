import { LIMIT_KEY } from "@banijjik/contracts";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import {
  buildPosDeviceCountReader,
  type PosDeviceCounter,
  type PosDeviceLimit,
} from "../modules/commerce/pos/index.js";
import { buildOrganizationLimitLock } from "../modules/core/organization/index.js";
import { buildLimitGuard, type OrgConfigService } from "../modules/platform/entitlement/index.js";

/**
 * The limit counts devices at every location, but `pos_devices` is location-scoped, so a manager
 * of one location would see only theirs. The count runs in the same organization with every
 * location (refused for any other organization); the active transaction session is kept.
 */
function deviceCounterOf(): PosDeviceCounter {
  const devices = buildPosDeviceCountReader();
  return {
    countActive: (organizationId) =>
      runInOrganizationContext(organizationId, () => devices.countActive()),
  };
}

function deviceLimitOf(orgConfig: OrgConfigService, counter: PosDeviceCounter): PosDeviceLimit {
  const lock = buildOrganizationLimitLock();
  const limits = buildLimitGuard(orgConfig);
  return {
    async assertCanAdd(organizationId) {
      await lock.acquire(organizationId);
      await limits.assertBelow(LIMIT_KEY.POS_DEVICES, await counter.countActive(organizationId));
    },
  };
}

/** One counter for both the limit check and the usage read, so they always count the same devices. */
export function buildPosDeviceLimitParts(orgConfig: OrgConfigService): {
  deviceCounter: PosDeviceCounter;
  deviceLimit: PosDeviceLimit;
} {
  const deviceCounter = deviceCounterOf();
  return { deviceCounter, deviceLimit: deviceLimitOf(orgConfig, deviceCounter) };
}
