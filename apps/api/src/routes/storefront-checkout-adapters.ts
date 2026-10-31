import type { CurrencyCode } from "@banijjik/contracts";
import type { OrderLineSnapshot } from "@banijjik/contracts/sales";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import type {
  CheckoutFulfillment,
  CheckoutSelection,
  PublicQuoteLine,
} from "@banijjik/contracts/website";
import {
  asId,
  type BookingId,
  type CustomerAccountId,
  type OfferingId,
  type OrderId,
  type OrganizationId,
} from "@banijjik/ids";
import { MongoBookingRepository } from "../modules/commerce/booking/index.js";
import {
  buildDefaultCatalogQuoteReader,
  type CatalogQuoteLineRequest,
  type CatalogQuoteReader,
} from "../modules/commerce/catalog/index.js";
import {
  buildCustomerAccountLookup,
  buildProvisionalGuestContactCreator,
  type ProvisionalGuestContactCreatorOptions,
} from "../modules/commerce/contact/index.js";
import { MongoEnrollmentRepository } from "../modules/commerce/enrollment/index.js";
import { MongoPaymentSummaryRepository } from "../modules/commerce/payment/index.js";
import { MongoOrderRepository } from "../modules/commerce/sales/index.js";
import {
  type CatalogQuoteReaderPort,
  type CustomerPhoneReaderPort,
  type GuestContactPort,
  type OrgStorefrontConfigReader,
  type PricedSelectionsResult,
  type RequestStatusReaderPort,
  type RequestStatusSnapshot,
  type StorefrontOrderItem,
  type StorefrontOrganizationConfig,
} from "../modules/commerce/website/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

export function buildCatalogQuoteReaderAdapter(
  catalogReader: CatalogQuoteReader = buildDefaultCatalogQuoteReader(),
): CatalogQuoteReaderPort {
  return {
    priceSelections: async (input: {
      readonly organizationId: string;
      readonly locationId: string;
      readonly selections: readonly CheckoutSelection[];
      readonly fulfillment: CheckoutFulfillment;
    }): Promise<PricedSelectionsResult> => {
      const lineRequests: CatalogQuoteLineRequest[] = input.selections.map((sel) => ({
        offeringId: asId<OfferingId>(sel.selection.offeringId),
        variantId: sel.selection.variantId,
        quantity:
          "quantity" in sel.selection && typeof sel.selection.quantity === "number"
            ? sel.selection.quantity
            : 1,
        modifierOptionIds:
          "modifierOptionIds" in sel.selection && Array.isArray(sel.selection.modifierOptionIds)
            ? sel.selection.modifierOptionIds
            : [],
      }));

      const readSources = await catalogReader.readLines({
        organizationId: asId<OrganizationId>(input.organizationId),
        locationId: input.locationId,
        lines: lineRequests,
      });

      const lines: PublicQuoteLine[] = [];
      let totalAmount = 0;
      let currency: CurrencyCode = "BDT";

      for (let i = 0; i < input.selections.length; i++) {
        const sel = input.selections[i];
        if (!sel) continue;
        const source = readSources[i];
        const lineTotal = source ? source.unitPriceMinor * source.quantity : 0;
        if (source) currency = source.currency as CurrencyCode;
        totalAmount += lineTotal;
        const reqDeposit = sel.selection.kind !== "PRODUCT";
        lines.push({
          selectionId: sel.selectionId,
          subtotal: { amount: lineTotal, currency },
          discount: { amount: 0, currency },
          tax: { amount: 0, currency },
          total: { amount: lineTotal, currency },
          amountRequiredBeforeConfirmation: reqDeposit
            ? { amount: Math.min(lineTotal, 1000), currency }
            : { amount: 0, currency },
        });
      }

      const deliveryCharge =
        input.fulfillment.kind === "DELIVERY" || input.fulfillment.method === "COURIER"
          ? { amount: 60, currency }
          : { amount: 0, currency };
      totalAmount += deliveryCharge.amount;
      return { lines, total: { amount: totalAmount, currency }, deliveryCharge, configVersion: 1 };
    },
  };
}

export function buildGuestContactAdapter(
  options: ProvisionalGuestContactCreatorOptions,
): GuestContactPort {
  const creator = buildProvisionalGuestContactCreator(options);
  return {
    ensureProvisionalContact: async (input) => {
      const res = await creator.execute({
        organizationId: input.organizationId,
        guestSessionId: input.guestSessionId,
        name: input.contactSnapshot.name,
        phoneE164: input.contactSnapshot.phoneE164,
        customFields: input.contactSnapshot.customFields,
      });
      return res.contactId;
    },
  };
}

export function buildCustomerPhoneReaderAdapter(): CustomerPhoneReaderPort {
  const lookup = buildCustomerAccountLookup();
  return {
    getVerifiedPhone: async (_orgId: string, customerAccountId: string) => {
      const account = await lookup.findById(asId<CustomerAccountId>(customerAccountId));
      return account ? account.phoneE164 : null;
    },
  };
}

interface StatusReaderInput {
  readonly organizationId: string;
  readonly requestId: string;
}

async function readOrderStatus(
  input: StatusReaderInput,
  orders: MongoOrderRepository,
  summaries: MongoPaymentSummaryRepository,
): Promise<RequestStatusSnapshot | null> {
  const order = await orders.findById(asId<OrderId>(input.requestId));
  if (!order || order.organizationId !== input.organizationId) return null;
  const summary = await summaries.findByRequest(
    asId(input.organizationId),
    PAYMENT_REQUEST_TYPE.ORDER,
    input.requestId,
  );
  return {
    requestId: order.orderId,
    requestType: "ORDER",
    publicNumber: order.orderNumber,
    status: order.status,
    paymentRequired: summary ? summary.due : order.totals.grandTotal,
    holdExpiresAt: null,
    createdAt: order.createdAt,
    items: projectStorefrontOrderItems(order.lines),
    fulfillment: { method: order.fulfillment.method },
  };
}

export function projectStorefrontOrderItems(
  lines: readonly OrderLineSnapshot[],
): readonly StorefrontOrderItem[] {
  return lines.map((line) => ({
    name: line.nameSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
  }));
}

async function readBookingStatus(
  input: StatusReaderInput,
  bookings: MongoBookingRepository,
  summaries: MongoPaymentSummaryRepository,
): Promise<RequestStatusSnapshot | null> {
  const booking = await bookings.findById(asId<BookingId>(input.requestId));
  if (!booking || booking.organizationId !== input.organizationId) return null;
  const summary = await summaries.findByRequest(
    asId(input.organizationId),
    PAYMENT_REQUEST_TYPE.BOOKING,
    input.requestId,
  );
  return {
    requestId: booking.bookingId,
    requestType: "BOOKING",
    publicNumber: booking.bookingNumber,
    status: booking.status,
    paymentRequired: summary ? summary.due : booking.depositRequired,
    holdExpiresAt: booking.holdExpiresAt,
    createdAt: booking.createdAt,
    schedule: { startsAt: booking.startsAt, endsAt: booking.endsAt },
  };
}

async function readEnrollmentStatus(
  input: StatusReaderInput,
  enrollments: MongoEnrollmentRepository,
  summaries: MongoPaymentSummaryRepository,
): Promise<RequestStatusSnapshot | null> {
  const enrollment = await enrollments.find(input.requestId);
  if (!enrollment || enrollment.organizationId !== input.organizationId) return null;
  const summary = await summaries.findByRequest(
    asId(input.organizationId),
    PAYMENT_REQUEST_TYPE.ENROLLMENT,
    enrollment.currentEnrollmentPeriodId,
  );
  return {
    requestId: enrollment.enrollmentId,
    requestType: "ENROLLMENT",
    publicNumber: enrollment.enrollmentNumber,
    status: enrollment.status,
    paymentRequired: summary ? summary.due : { amount: 0, currency: "BDT" },
    holdExpiresAt: null,
    createdAt: enrollment.createdAt,
    plan: { startsOn: enrollment.startsOn, endsOn: enrollment.endsOn },
  };
}

export function buildStorefrontRequestStatusReaderAdapter(): RequestStatusReaderPort {
  const orders = new MongoOrderRepository();
  const bookings = new MongoBookingRepository();
  const enrollments = new MongoEnrollmentRepository();
  const summaries = new MongoPaymentSummaryRepository();

  return {
    readStatus: async (input) => {
      if (input.requestType === "ORDER") {
        return readOrderStatus(input, orders, summaries);
      }
      if (input.requestType === "BOOKING") {
        return readBookingStatus(input, bookings, summaries);
      }
      if (input.requestType === "ENROLLMENT") {
        return readEnrollmentStatus(input, enrollments, summaries);
      }
      return null;
    },
  };
}

export function buildOrgStorefrontConfigReaderAdapter(
  orgConfig: OrgConfigService,
): OrgStorefrontConfigReader {
  return {
    readStorefrontConfig: async (organizationId: string): Promise<StorefrontOrganizationConfig> => {
      const resolved = await orgConfig.forOrganization(organizationId);
      return {
        checkoutEnabled: Boolean(resolved.config.settings["website.checkoutEnabled"] ?? true),
        isReadOnly: resolved.accessMode === "READ_ONLY",
        isSuspended: false,
        publicLocationIds:
          (resolved.config.settings["website.publicLocationIds"] as string[]) ?? [],
        configVersion: resolved.config.configVersion ?? 1,
      };
    },
  };
}

export function buildResolveCustomerContactId(): (
  organizationId: string,
  customerAccountId: string,
) => Promise<string | undefined> {
  const lookup = buildCustomerAccountLookup();
  return async (_orgId: string, customerAccountId: string) => {
    const account = await lookup.findById(asId<CustomerAccountId>(customerAccountId));
    return account?.contactId;
  };
}
