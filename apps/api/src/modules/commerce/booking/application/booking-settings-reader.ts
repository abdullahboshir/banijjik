import {
  BOOKING_DEPOSIT_REQUIRED_DEFAULT,
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_DEFAULT,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_FEE_PERCENT_DEFAULT,
  BOOKING_FEE_PERCENT_SETTING_KEY,
  BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  BOOKING_FREE_CANCEL_HOURS_SETTING_KEY,
  BOOKING_HOLD_MINUTES_DEFAULT,
  BOOKING_HOLD_MINUTES_SETTING_KEY,
  BOOKING_LATE_CANCEL_FEE_DEFAULT,
  BOOKING_LATE_CANCEL_FEE_SETTING_KEY,
  BOOKING_MIN_NOTICE_MINUTES_DEFAULT,
  BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY,
  BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT,
  BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY,
  BOOKING_NO_SHOW_FEE_DEFAULT,
  BOOKING_NO_SHOW_FEE_SETTING_KEY,
  BOOKING_REQUIRE_APPROVAL_SETTING_KEY,
  BOOKING_SLOT_STEP_MINUTES_DEFAULT,
  BOOKING_SLOT_STEP_MINUTES_SETTING_KEY,
  CANCEL_FEE_MODE,
  DEPOSIT_REQUIRED,
  type CancelFeeMode,
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

function cancelFeeModeOf(value: unknown, fallback: CancelFeeMode): CancelFeeMode {
  if (
    typeof value === "string" &&
    (Object.values(CANCEL_FEE_MODE) as readonly string[]).includes(value)
  ) {
    return value as CancelFeeMode;
  }
  return fallback;
}

const BOOKING_SETTING_KEYS = [
  BOOKING_SLOT_STEP_MINUTES_SETTING_KEY,
  BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY,
  BOOKING_REQUIRE_APPROVAL_SETTING_KEY,
  BOOKING_HOLD_MINUTES_SETTING_KEY,
  BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY,
  BOOKING_DEPOSIT_REQUIRED_SETTING_KEY,
  BOOKING_DEPOSIT_VALUE_SETTING_KEY,
  BOOKING_FREE_CANCEL_HOURS_SETTING_KEY,
  BOOKING_LATE_CANCEL_FEE_SETTING_KEY,
  BOOKING_NO_SHOW_FEE_SETTING_KEY,
  BOOKING_FEE_PERCENT_SETTING_KEY,
] as const;

function readVal(resolved: ReadonlyMap<string, { readonly value: unknown }>, key: string): unknown {
  return resolved.get(key)?.value;
}

function mapResolvedSettings(resolved: ReadonlyMap<string, { readonly value: unknown }>) {
  return {
    slotStepMinutes: numberOrDefault(
      readVal(resolved, BOOKING_SLOT_STEP_MINUTES_SETTING_KEY),
      BOOKING_SLOT_STEP_MINUTES_DEFAULT,
    ),
    minNoticeMinutes: numberOrDefault(
      readVal(resolved, BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY),
      BOOKING_MIN_NOTICE_MINUTES_DEFAULT,
    ),
    requireApproval: readVal(resolved, BOOKING_REQUIRE_APPROVAL_SETTING_KEY) === true,
    holdMinutes: numberOrDefault(
      readVal(resolved, BOOKING_HOLD_MINUTES_SETTING_KEY),
      BOOKING_HOLD_MINUTES_DEFAULT,
    ),
    noShowAfterMinutes: numberOrDefault(
      readVal(resolved, BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY),
      BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT,
    ),
    depositRequired: depositModeOf(readVal(resolved, BOOKING_DEPOSIT_REQUIRED_SETTING_KEY)),
    depositValue: numberOrDefault(
      readVal(resolved, BOOKING_DEPOSIT_VALUE_SETTING_KEY),
      BOOKING_DEPOSIT_VALUE_DEFAULT,
    ),
    freeCancelHours: numberOrDefault(
      readVal(resolved, BOOKING_FREE_CANCEL_HOURS_SETTING_KEY),
      BOOKING_FREE_CANCEL_HOURS_DEFAULT,
    ),
    lateCancelFee: cancelFeeModeOf(
      readVal(resolved, BOOKING_LATE_CANCEL_FEE_SETTING_KEY),
      BOOKING_LATE_CANCEL_FEE_DEFAULT,
    ),
    noShowFee: cancelFeeModeOf(
      readVal(resolved, BOOKING_NO_SHOW_FEE_SETTING_KEY),
      BOOKING_NO_SHOW_FEE_DEFAULT,
    ),
    feePercent: numberOrDefault(
      readVal(resolved, BOOKING_FEE_PERCENT_SETTING_KEY),
      BOOKING_FEE_PERCENT_DEFAULT,
    ),
  };
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
        keys: BOOKING_SETTING_KEYS,
      });
      return mapResolvedSettings(resolved);
    },
  };
}
