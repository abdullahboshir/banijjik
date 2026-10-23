import { LIMIT_KEY, MODULE_KEY, PACKAGE_KEY, type LimitMap } from "@banijjik/contracts";
import type { SeedPackage } from "../application/seed-package.js";
import type { LimitIncrements } from "../domain/package.entity.js";

/** Every base package includes all CORE modules (10-MODULE-CATALOG section 1). */
export const CORE_MODULE_KEYS: readonly string[] = [
  MODULE_KEY.CONTACT,
  MODULE_KEY.CATALOG,
  MODULE_KEY.INVENTORY,
  MODULE_KEY.PRICING,
  MODULE_KEY.SALES,
  MODULE_KEY.BOOKING,
  MODULE_KEY.ENROLLMENT,
  MODULE_KEY.PAYMENT,
  MODULE_KEY.EXPENSE,
  MODULE_KEY.REPORT,
  MODULE_KEY.DELIVERY,
  MODULE_KEY.COURIER,
  MODULE_KEY.SMS,
  MODULE_KEY.RISK,
];

/** An add-on's own limits are not used; it adds through `limitIncrements`. */
const NO_LIMITS: LimitMap = {
  [LIMIT_KEY.LOCATIONS]: 0,
  [LIMIT_KEY.MEMBERS]: 0,
  [LIMIT_KEY.OFFERINGS]: 0,
  [LIMIT_KEY.ORDERS_PER_MONTH]: 0,
  [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: 0,
  [LIMIT_KEY.SMS_PER_MONTH]: 0,
  [LIMIT_KEY.CHANNELS]: 0,
  [LIMIT_KEY.POS_DEVICES]: 0,
};

interface BaseLimits {
  readonly locations: number;
  readonly members: number;
  readonly offerings: number;
  readonly ordersPerMonth: number;
  readonly aiMessagesPerMonth: number;
  readonly smsPerMonth: number;
  readonly channels: number;
  readonly posDevices: number;
}

function basePackage(
  packageKey: string,
  extraModuleKeys: readonly string[],
  limits: BaseLimits,
): SeedPackage {
  return {
    packageKey,
    isAddOn: false,
    moduleKeys: [...CORE_MODULE_KEYS, ...extraModuleKeys],
    limits,
    limitIncrements: {},
  };
}

function moduleAddOn(packageKey: string, moduleKeys: readonly string[]): SeedPackage {
  return { packageKey, isAddOn: true, moduleKeys, limits: NO_LIMITS, limitIncrements: {} };
}

function limitPack(packageKey: string, limitIncrements: LimitIncrements): SeedPackage {
  return { packageKey, isAddOn: true, moduleKeys: [], limits: NO_LIMITS, limitIncrements };
}

const CHAT_MODULE_KEYS = [MODULE_KEY.MESSAGING, MODULE_KEY.BOT, MODULE_KEY.SOCIAL];

/**
 * The base packages and add-ons of 10-MODULE-CATALOG section 9. The numbers are seed proposals:
 * an operator edits them in the platform panel (card 1.8) and prices arrive with P2. A package is
 * inserted once; the seed never overwrites an edited one.
 */
export const SEED_PACKAGES: readonly SeedPackage[] = [
  basePackage(PACKAGE_KEY.STORE, [MODULE_KEY.WEBSITE], {
    locations: 1,
    members: 3,
    offerings: 500,
    ordersPerMonth: 1000,
    aiMessagesPerMonth: 0,
    smsPerMonth: 100,
    channels: 0,
    posDevices: 0,
  }),
  basePackage(PACKAGE_KEY.CHAT, CHAT_MODULE_KEYS, {
    locations: 1,
    members: 3,
    offerings: 500,
    ordersPerMonth: 1000,
    aiMessagesPerMonth: 1000,
    smsPerMonth: 100,
    channels: 2,
    posDevices: 0,
  }),
  basePackage(PACKAGE_KEY.SHOP, [MODULE_KEY.POS], {
    locations: 1,
    members: 5,
    offerings: 2000,
    ordersPerMonth: 5000,
    aiMessagesPerMonth: 0,
    smsPerMonth: 100,
    channels: 0,
    posDevices: 1,
  }),
  basePackage(
    PACKAGE_KEY.BUNDLE,
    [MODULE_KEY.WEBSITE, ...CHAT_MODULE_KEYS, MODULE_KEY.POS, MODULE_KEY.WORKFLOW],
    {
      locations: 2,
      members: 10,
      offerings: 5000,
      ordersPerMonth: 10000,
      aiMessagesPerMonth: 3000,
      smsPerMonth: 300,
      channels: 3,
      posDevices: 2,
    },
  ),
  moduleAddOn(PACKAGE_KEY.ADDON_BOOKKEEPING, [MODULE_KEY.BOOKKEEPING]),
  moduleAddOn(PACKAGE_KEY.ADDON_PAYMENT_GATEWAY, [MODULE_KEY.PAYMENT_GATEWAY]),
  moduleAddOn(PACKAGE_KEY.ADDON_AUTOMATION, [MODULE_KEY.WORKFLOW]),
  moduleAddOn(PACKAGE_KEY.ADDON_WEBSITE, [MODULE_KEY.WEBSITE]),
  moduleAddOn(PACKAGE_KEY.ADDON_CHAT, CHAT_MODULE_KEYS),
  moduleAddOn(PACKAGE_KEY.ADDON_POS, [MODULE_KEY.POS]),
  moduleAddOn(PACKAGE_KEY.ADDON_CAPABILITY_ACADEMIC, [MODULE_KEY.ACADEMIC]),
  moduleAddOn(PACKAGE_KEY.ADDON_CAPABILITY_CLINICAL, [MODULE_KEY.CLINICAL]),
  moduleAddOn(PACKAGE_KEY.ADDON_CAPABILITY_KITCHEN, [MODULE_KEY.KITCHEN_DISPLAY]),
  moduleAddOn(PACKAGE_KEY.ADDON_COMMISSION, [MODULE_KEY.COMMISSION]),
  limitPack(PACKAGE_KEY.PACK_LOCATION, { [LIMIT_KEY.LOCATIONS]: 1 }),
  limitPack(PACKAGE_KEY.PACK_MEMBERS_5, { [LIMIT_KEY.MEMBERS]: 5 }),
  limitPack(PACKAGE_KEY.PACK_AI_1000, { [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: 1000 }),
  limitPack(PACKAGE_KEY.PACK_SMS_500, { [LIMIT_KEY.SMS_PER_MONTH]: 500 }),
];
