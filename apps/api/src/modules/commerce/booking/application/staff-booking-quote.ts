import { OFFERING_KIND, SEQUENCE_KEY } from "@banijjik/contracts";
import { BOOKING_MODE } from "@banijjik/contracts/catalog";
import { BOOKING_RULE_KEY, BOOKING_STATUS, type Money } from "@banijjik/contracts/booking";
import type {
  LocationId,
  OfferingId,
  OrganizationId,
  OrganizationId as OrgId,
} from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import { bookingRuleError } from "../domain/errors.js";
import { computeDepositRequired } from "../domain/deposit.js";
import type {
  BookingOfferingReader,
  BookingSettingsReader,
  OfferingBookingView,
  PriceQuoterPort,
  ServiceOfferingView,
} from "./ports/booking-context-ports.js";

type StaffQuoteDependencies = {
  readonly offerings: BookingOfferingReader;
  readonly settings: BookingSettingsReader;
  readonly quoter: PriceQuoterPort;
};

function formatBookingNumber(value: number): string {
  return String(value).padStart(6, "0");
}

export async function loadActiveOffering(input: {
  dependencies: StaffQuoteDependencies;
  organizationId: OrganizationId;
  offeringId: OfferingId;
  variantId: string;
  locationId: LocationId;
}): Promise<OfferingBookingView> {
  const offering = await input.dependencies.offerings.readOffering(input);
  if (offering === undefined || !offering.isActive) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  if (
    offering.kind === OFFERING_KIND.SERVICE &&
    offering.service.bookingMode === BOOKING_MODE.WALK_IN_ONLY
  ) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  return offering;
}

export async function loadActiveServiceOffering(input: {
  dependencies: StaffQuoteDependencies;
  organizationId: OrganizationId;
  offeringId: OfferingId;
  variantId: string;
  locationId: LocationId;
}): Promise<ServiceOfferingView> {
  const offering = await loadActiveOffering(input);
  if (offering.kind !== OFFERING_KIND.SERVICE) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  return offering;
}

export async function staffBookingStatusAndNumber(input: {
  organizationId: OrganizationId;
  requireApproval: boolean;
}): Promise<{
  status: typeof BOOKING_STATUS.REQUESTED | typeof BOOKING_STATUS.CONFIRMED;
  bookingNumber: string | null;
}> {
  const status = input.requireApproval ? BOOKING_STATUS.REQUESTED : BOOKING_STATUS.CONFIRMED;
  const bookingNumber = formatBookingNumber(
    await nextSequenceValue({
      organizationId: input.organizationId,
      sequenceKey: SEQUENCE_KEY.BOOKING,
    }),
  );
  return { status, bookingNumber };
}

export async function quoteDepositForBooking(input: {
  dependencies: StaffQuoteDependencies;
  organizationId: OrgId;
  locationId: string;
  offeringId: string;
  variantId: string;
  quantity?: number | undefined;
  offering: OfferingBookingView;
}): Promise<{
  line: NonNullable<Awaited<ReturnType<PriceQuoterPort["quote"]>>["lines"][0]>;
  depositRequired: Money;
}> {
  const quote = await input.dependencies.quoter.quote({
    organizationId: input.organizationId,
    locationId: input.locationId,
    offeringId: input.offeringId,
    variantId: input.variantId,
    quantity: input.quantity ?? 1,
  });
  const line = quote.lines[0];
  if (line === undefined) throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);

  if (input.offering.kind === OFFERING_KIND.RENTAL) {
    if (input.offering.rental.depositAmount !== undefined) {
      return { line, depositRequired: input.offering.rental.depositAmount };
    }
    const settings = await input.dependencies.settings.read(input.organizationId);
    const depositRequired = computeDepositRequired({
      orgMode: settings.depositRequired,
      orgValue: settings.depositValue,
      offeringRule: undefined,
      lineTotal: line.lineNetTotal,
    });
    return { line, depositRequired };
  }

  const settings = await input.dependencies.settings.read(input.organizationId);
  const depositRequired = computeDepositRequired({
    orgMode: settings.depositRequired,
    orgValue: settings.depositValue,
    offeringRule: input.offering.service.depositRule,
    lineTotal: line.lineNetTotal,
  });
  return { line, depositRequired };
}
