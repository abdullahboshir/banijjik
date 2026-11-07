import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { BOOKING_TERMINATION_MODE, CANCEL_FEE_MODE } from "@banijjik/contracts/booking";
import { PAYMENT_REQUEST_TYPE, type Money } from "@banijjik/contracts/payment";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { asId, type OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../kernel/context/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import {
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  type MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  settleRequestTermination,
} from "../modules/commerce/payment/index.js";
import type { OrderPaymentPort } from "../modules/commerce/sales/index.js";

/** The organization of the running request; a missing one is a wiring fault, never a user error. */
export function activeOrganizationId(): OrganizationId {
  const { organizationId } = getRequestContext();
  if (!organizationId) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return asId<OrganizationId>(organizationId);
}

export function ruleError(ruleKey: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.BUSINESS_RULE, messageKey, details: { ruleKey } });
}

export async function terminateOrderPayment(
  deps: {
    summaries: MongoPaymentSummaryRepository;
    timezones: { read: (organizationId: OrganizationId) => Promise<string | undefined> };
  },
  input: Parameters<OrderPaymentPort["settleCancellation"]>[0],
  paid: Money,
): Promise<void> {
  if (input.contactId === null) {
    throw ruleError(SALES_RULE_KEY.ORDER_CANCEL_NEEDS_CONTACT, "errors.order_cancel_needs_contact");
  }
  await settleRequestTermination(
    {
      summaries: deps.summaries,
      payments: new MongoPaymentRepository(),
      storeCredits: new MongoStoreCreditRepository(),
      contactStoreCredit: new MongoContactStoreCreditAdapter(),
      events: kernelEventPublisher,
      timeZone: {
        read: async (organizationId) => {
          const timezone = await deps.timezones.read(organizationId);
          if (!timezone) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
          return timezone;
        },
      },
    },
    {
      ...input,
      contactId: input.contactId,
      requestId: input.orderId,
      requestType: PAYMENT_REQUEST_TYPE.ORDER,
      startsAt: input.now,
      depositRequired: paid,
      priceTotal: paid,
      mode: BOOKING_TERMINATION_MODE.CANCEL,
      freeCancelHours: 0,
      feeMode: CANCEL_FEE_MODE.NONE,
      feePercent: 0,
    },
  );
}
