import { ERROR_CODE } from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE, type Money } from "@banijjik/contracts/payment";
import type { OrganizationId } from "@banijjik/ids";
import { AppError } from "../kernel/http/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { DepositCheckPort } from "../modules/commerce/booking/index.js";
import {
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  settleBookingTermination,
  type ContactStoreCreditPort,
  type PaymentRepository,
  type PaymentSummaryRepository,
  type StoreCreditRepository,
} from "../modules/commerce/payment/index.js";
import {
  buildOrganizationTimezoneReader,
  type OrganizationTimezoneReader,
} from "../modules/core/organization/index.js";

function createTimezoneReader(timezones: OrganizationTimezoneReader) {
  return {
    read: async (organizationId: OrganizationId) => {
      const tz = await timezones.read(organizationId);
      if (tz === undefined) {
        throw new AppError({
          code: ERROR_CODE.NOT_FOUND,
          messageKey: "errors.not_found",
        });
      }
      return tz;
    },
  };
}

async function isBookingDepositSatisfied(
  summaries: PaymentSummaryRepository,
  input: {
    readonly organizationId: OrganizationId;
    readonly requestId: string;
    readonly requiredAmount: Money;
  },
): Promise<boolean> {
  if (input.requiredAmount.amount <= 0) return true;
  const summary = await summaries.findByRequest(
    input.organizationId,
    PAYMENT_REQUEST_TYPE.BOOKING,
    input.requestId,
  );
  if (!summary) return false;
  const netPaid = summary.allocated.amount - summary.refunded.amount;
  return netPaid >= input.requiredAmount.amount;
}

export interface BookingDepositAdapterDependencies {
  readonly summaries?: PaymentSummaryRepository;
  readonly payments?: PaymentRepository;
  readonly storeCredits?: StoreCreditRepository;
  readonly contactStoreCredit?: ContactStoreCreditPort;
  readonly timezones?: OrganizationTimezoneReader;
  readonly events?: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
}

function resolvePaymentRepos(deps?: BookingDepositAdapterDependencies) {
  if (!deps) {
    return {
      summaries: new MongoPaymentSummaryRepository(),
      payments: new MongoPaymentRepository(),
      storeCredits: new MongoStoreCreditRepository(),
    };
  }
  return {
    summaries: deps.summaries ?? new MongoPaymentSummaryRepository(),
    payments: deps.payments ?? new MongoPaymentRepository(),
    storeCredits: deps.storeCredits ?? new MongoStoreCreditRepository(),
  };
}

function resolveServices(deps?: BookingDepositAdapterDependencies) {
  if (!deps) {
    return {
      contactStoreCredit: new MongoContactStoreCreditAdapter(),
      timezones: buildOrganizationTimezoneReader(),
      events: kernelEventPublisher,
    };
  }
  return {
    contactStoreCredit: deps.contactStoreCredit ?? new MongoContactStoreCreditAdapter(),
    timezones: deps.timezones ?? buildOrganizationTimezoneReader(),
    events: deps.events ?? kernelEventPublisher,
  };
}

export function buildBookingDepositCheckAdapter(
  deps?: BookingDepositAdapterDependencies,
): DepositCheckPort {
  const repos = resolvePaymentRepos(deps);
  const services = resolveServices(deps);
  const timeZone = createTimezoneReader(services.timezones);

  return {
    isDepositSatisfied: (input) => isBookingDepositSatisfied(repos.summaries, input),
    initializeSummary: async (input) => {
      await repos.summaries.ensureSummary({
        organizationId: input.organizationId,
        locationId: input.locationId,
        requestType: PAYMENT_REQUEST_TYPE.BOOKING,
        requestId: input.requestId,
        contactId: input.contactId,
        total: input.total,
        now: input.now,
      });
    },
    settleBookingTermination: (input) =>
      settleBookingTermination(
        {
          payments: repos.payments,
          storeCredits: repos.storeCredits,
          summaries: repos.summaries,
          contactStoreCredit: services.contactStoreCredit,
          events: services.events,
          timeZone,
        },
        input,
      ),
  };
}
