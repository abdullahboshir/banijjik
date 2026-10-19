import {
  INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY,
  INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY,
  INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY,
} from "@banijjik/contracts/inventory";
import type { ModuleManifest } from "@banijjik/contracts";
import { buildSettingsResolver } from "../../../core/settings/index.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import type { InventorySettingsReader } from "./ports/inventory-context-ports.js";

export function buildInventorySettingsReader(input: {
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}): InventorySettingsReader {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    allowNegativeStock: async (organizationId) =>
      booleanSetting(
        await resolver.resolve(organizationId, {
          keys: [INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY],
        }),
        INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY,
        false,
      ),
    lowStockDefault: async (organizationId) =>
      integerSetting(
        await resolver.resolve(organizationId, { keys: [INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY] }),
        INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY,
        0,
      ),
    adjustmentApprovalAbove: async (organizationId) =>
      integerSetting(
        await resolver.resolve(organizationId, {
          keys: [INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY],
        }),
        INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY,
        0,
      ),
    lowStockThresholdForItem: async (organizationId, itemThreshold) =>
      itemThreshold ??
      integerSetting(
        await resolver.resolve(organizationId, { keys: [INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY] }),
        INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY,
        0,
      ),
  };
}

function booleanSetting(
  resolved: Awaited<ReturnType<ReturnType<typeof buildSettingsResolver>["resolve"]>>,
  key: string,
  fallback: boolean,
): boolean {
  const value = resolved.get(key)?.value;
  return typeof value === "boolean" ? value : fallback;
}

function integerSetting(
  resolved: Awaited<ReturnType<ReturnType<typeof buildSettingsResolver>["resolve"]>>,
  key: string,
  fallback: number,
): number {
  const value = resolved.get(key)?.value;
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}
