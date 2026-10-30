import type { ModuleManifest } from "@banijjik/contracts";
import {
  BOOKING_COMPLETE_GRACE_MINUTES_DEFAULT,
  BOOKING_DEPOSIT_REQUIRED_DEFAULT,
  BOOKING_DEPOSIT_VALUE_DEFAULT,
  BOOKING_FEE_PERCENT_DEFAULT,
  BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  BOOKING_HOLD_MINUTES_DEFAULT,
  BOOKING_LATE_CANCEL_FEE_DEFAULT,
  BOOKING_MIN_NOTICE_MINUTES_DEFAULT,
  BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT,
  BOOKING_NO_SHOW_FEE_DEFAULT,
  BOOKING_SLOT_STEP_MINUTES_DEFAULT,
} from "@banijjik/contracts/booking";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import { systemClock, type Clock } from "../kernel/time/index.js";
import {
  buildBookingPaymentLifecycle,
  buildBookingSettingsReader,
  MongoBookingRepository,
  type BookingPaymentLifecyclePort,
} from "../modules/commerce/booking/index.js";
import type { RequestPaymentLifecycle } from "../modules/commerce/payment/index.js";
import { buildAuditRecorder } from "../modules/core/audit/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildBookingDepositCheckAdapter } from "./booking-deposit-adapter.js";

export interface BookingPaymentLifecycleAdapterOptions {
  readonly port?: BookingPaymentLifecyclePort;
  readonly orgConfig?: OrgConfigService;
  readonly manifests?: readonly ModuleManifest[];
  readonly clock?: Clock;
  readonly audit?: AuditRecorder;
}

const DEFAULT_BOOKING_SETTINGS = {
  slotStepMinutes: BOOKING_SLOT_STEP_MINUTES_DEFAULT,
  minNoticeMinutes: BOOKING_MIN_NOTICE_MINUTES_DEFAULT,
  holdMinutes: BOOKING_HOLD_MINUTES_DEFAULT,
  depositRequired: BOOKING_DEPOSIT_REQUIRED_DEFAULT,
  depositValue: BOOKING_DEPOSIT_VALUE_DEFAULT,
  requireApproval: true,
  freeCancelHours: BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  lateCancelFee: BOOKING_LATE_CANCEL_FEE_DEFAULT,
  noShowAfterMinutes: BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT,
  noShowFee: BOOKING_NO_SHOW_FEE_DEFAULT,
  feePercent: BOOKING_FEE_PERCENT_DEFAULT,
  completeGraceMinutes: BOOKING_COMPLETE_GRACE_MINUTES_DEFAULT,
};

function resolveSettingsReader(opts?: BookingPaymentLifecycleAdapterOptions) {
  if (opts?.orgConfig && opts?.manifests) {
    return buildBookingSettingsReader({ orgConfig: opts.orgConfig, manifests: opts.manifests });
  }
  return {
    read: async () => DEFAULT_BOOKING_SETTINGS,
  };
}

export function buildDefaultBookingPaymentLifecycle(
  opts?: BookingPaymentLifecycleAdapterOptions,
): BookingPaymentLifecyclePort {
  if (opts?.port) {
    return opts.port;
  }

  const clock = opts?.clock ?? systemClock;
  const audit = opts?.audit ?? buildAuditRecorder(clock);
  const bookings = new MongoBookingRepository();
  const unitOfWork = new MongoUnitOfWork();
  const depositCheck = buildBookingDepositCheckAdapter();
  const settings = resolveSettingsReader(opts);

  return buildBookingPaymentLifecycle({
    bookings,
    unitOfWork,
    depositCheck,
    settings,
    events: kernelEventPublisher,
    audit,
  });
}

export function buildBookingPaymentLifecycleAdapter(
  portOrOpts?: BookingPaymentLifecyclePort | BookingPaymentLifecycleAdapterOptions,
): RequestPaymentLifecycle {
  const port =
    portOrOpts && "beginReceipt" in portOrOpts
      ? portOrOpts
      : buildDefaultBookingPaymentLifecycle(portOrOpts);

  return {
    async beginReceipt(input) {
      await port.beginReceipt({
        organizationId: input.organizationId,
        bookingId: input.requestId,
        now: input.now,
      });
    },
    async endReceipt(input) {
      await port.endReceipt({
        organizationId: input.organizationId,
        bookingId: input.requestId,
        now: input.now,
      });
    },
  };
}
