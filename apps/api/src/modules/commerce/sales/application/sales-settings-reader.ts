import { INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY } from "@banijjik/contracts/inventory";
import type { ModuleManifest } from "@banijjik/contracts";
import {
  SALES_ADVANCE_VALUE_SETTING_KEY,
  SALES_ADVANCE_VALUE_DEFAULT,
  SALES_ADVANCE_REQUIRED,
  SALES_ADVANCE_REQUIRED_DEFAULT,
  SALES_ADVANCE_REQUIRED_SETTING_KEY,
  SALES_AUTO_CONFIRM_DEFAULT,
  SALES_AUTO_CONFIRM_SETTING_KEY,
  SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_DEFAULT,
  SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_SETTING_KEY,
  SALES_DRAFT_EXPIRY_HOURS_DEFAULT,
  SALES_DRAFT_EXPIRY_HOURS_SETTING_KEY,
  SALES_PLACED_AUTO_CANCEL_HOURS_DEFAULT,
  SALES_PLACED_AUTO_CANCEL_HOURS_SETTING_KEY,
  SALES_USE_PACKING_DEFAULT,
  SALES_USE_PACKING_SETTING_KEY,
  type SalesAdvanceRequired,
} from "@banijjik/contracts/sales";
import type { OrganizationId } from "@banijjik/ids";
import { buildSettingsResolver } from "../../../core/settings/index.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import type { SalesSettings, SalesSettingsReader } from "./ports/sales-ports.js";

function booleanOf(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function hoursOf(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function advanceOf(value: unknown): SalesAdvanceRequired {
  if (
    typeof value === "string" &&
    (Object.values(SALES_ADVANCE_REQUIRED) as string[]).includes(value)
  ) {
    return value as SalesAdvanceRequired;
  }
  return SALES_ADVANCE_REQUIRED_DEFAULT;
}

/** Reads `sales.*` and the inventory negative-stock switch before an order transaction opens. */
export function buildSalesSettingsReader(input: {
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}): SalesSettingsReader {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    read: async (organizationId: OrganizationId) => {
      const resolved = await resolver.resolve(organizationId, {
        keys: [
          SALES_AUTO_CONFIRM_SETTING_KEY,
          SALES_DRAFT_EXPIRY_HOURS_SETTING_KEY,
          SALES_PLACED_AUTO_CANCEL_HOURS_SETTING_KEY,
          SALES_USE_PACKING_SETTING_KEY,
          SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_SETTING_KEY,
          SALES_ADVANCE_REQUIRED_SETTING_KEY,
          SALES_ADVANCE_VALUE_SETTING_KEY,
          INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY,
        ],
      });
      const settings: SalesSettings = {
        autoConfirm: booleanOf(
          resolved.get(SALES_AUTO_CONFIRM_SETTING_KEY)?.value,
          SALES_AUTO_CONFIRM_DEFAULT,
        ),
        draftExpiryHours: hoursOf(
          resolved.get(SALES_DRAFT_EXPIRY_HOURS_SETTING_KEY)?.value,
          SALES_DRAFT_EXPIRY_HOURS_DEFAULT,
        ),
        placedAutoCancelHours: hoursOf(
          resolved.get(SALES_PLACED_AUTO_CANCEL_HOURS_SETTING_KEY)?.value,
          SALES_PLACED_AUTO_CANCEL_HOURS_DEFAULT,
        ),
        usePacking: booleanOf(
          resolved.get(SALES_USE_PACKING_SETTING_KEY)?.value,
          SALES_USE_PACKING_DEFAULT,
        ),
        discountOwnerWithoutApproval: booleanOf(
          resolved.get(SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_SETTING_KEY)?.value,
          SALES_DISCOUNT_OWNER_WITHOUT_APPROVAL_DEFAULT,
        ),
        advanceValue: Math.max(
          0,
          hoursOf(
            resolved.get(SALES_ADVANCE_VALUE_SETTING_KEY)?.value,
            SALES_ADVANCE_VALUE_DEFAULT,
          ),
        ),
        advanceRequired: advanceOf(resolved.get(SALES_ADVANCE_REQUIRED_SETTING_KEY)?.value),
        allowNegativeStock: booleanOf(
          resolved.get(INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY)?.value,
          false,
        ),
      };
      return settings;
    },
  };
}
