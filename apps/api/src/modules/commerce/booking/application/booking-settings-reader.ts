import {
  BOOKING_DEPOSIT_REQUIRED_DEFAULT,
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_DEFAULT,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_HOLD_MINUTES_DEFAULT,
  BOOKING_HOLD_MINUTES_SETTING_KEY,
  BOOKING_MIN_NOTICE_MINUTES_DEFAULT,
  BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY,
  BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT,
  BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY,
  BOOKING_REQUIRE_APPROVAL_SETTING_KEY,
  BOOKING_SLOT_STEP_MINUTES_DEFAULT,
  BOOKING_SLOT_STEP_MINUTES_SETTING_KEY,
  DEPOSIT_REQUIRED,
  type DepositRequired,
} from "@banijjik/contracts/booking";
import type { ModuleManifest } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import { buildSettingsResolver } from "../../../core/settings/index.js";
import type { OrgConfigService } from "../../../platform/entitlement/index.js";
import type { BookingSettingsReader } from "./ports/booking-context-ports.js";

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function depositModeOf(value: unknown): DepositRequired {
  if (
    typeof value === "string" &&
    (Object.values(DEPOSIT_REQUIRED) as readonly string[]).includes(value)
  ) {
    return value as DepositRequired;
  }
  return BOOKING_DEPOSIT_REQUIRED_DEFAULT;
}

export function buildBookingSettingsReader(input: {
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}): BookingSettingsReader {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    read: async (organizationId: OrganizationId) => {
      const resolved = await resolver.resolve(organizationId, {
        keys: [
          BOOKING_SLOT_STEP_MINUTES_SETTING_KEY,
          BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY,
          BOOKING_REQUIRE_APPROVAL_SETTING_KEY,
          BOOKING_HOLD_MINUTES_SETTING_KEY,
          BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY,
          BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
          BOOKING_DEPOSIT_VALUE_SETTING_KEY,
        ],
      });
      return {
        slotStepMinutes: numberOrDefault(
          resolved.get(BOOKING_SLOT_STEP_MINUTES_SETTING_KEY)?.value,
          BOOKING_SLOT_STEP_MINUTES_DEFAULT,
        ),
        minNoticeMinutes: numberOrDefault(
          resolved.get(BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY)?.value,
          BOOKING_MIN_NOTICE_MINUTES_DEFAULT,
        ),
        requireApproval: resolved.get(BOOKING_REQUIRE_APPROVAL_SETTING_KEY)?.value === true,
        holdMinutes: numberOrDefault(
          resolved.get(BOOKING_HOLD_MINUTES_SETTING_KEY)?.value,
          BOOKING_HOLD_MINUTES_DEFAULT,
        ),
        noShowAfterMinutes: numberOrDefault(
          resolved.get(BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY)?.value,
          BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT,
        ),
        depositRequired: depositModeOf(resolved.get(BOOKING_DEPOSIT_REQUIRED_SETTING_KEY)?.value),
        depositValue: numberOrDefault(
          resolved.get(BOOKING_DEPOSIT_VALUE_SETTING_KEY)?.value,
          BOOKING_DEPOSIT_VALUE_DEFAULT,
        ),
      };
    },
  };
}
