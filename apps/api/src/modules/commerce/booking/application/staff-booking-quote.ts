import { BOOKING_MODE } from "@banijjik/contracts/catalog";
import { SEQUENCE_KEY } from "@banijjik/contracts";
import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import type { LocationId, OfferingId, OrganizationId } from "@banijjik/ids";
import { nextSequenceValue } from "../../../../kernel/sequence/index.js";
import { bookingRuleError } from "../domain/errors.js";
import { computeDepositRequired } from "../domain/deposit.js";
import type {
  BookingOfferingReader,
  BookingSettingsReader,
  PriceQuoterPort,
  ServiceOfferingView,
} from "./ports/booking-context-ports.js";
import type { OrganizationId as OrgId } from "@banijjik/ids";

type StaffQuoteDependencies = {
  readonly offerings: BookingOfferingReader;
  readonly settings: BookingSettingsReader;
  readonly quoter: PriceQuoterPort;
};

function formatBookingNumber(value: number): string {
  return String(value).padStart(6, "0");
}

export async function loadActiveServiceOffering(input: {
  dependencies: StaffQuoteDependencies;
  organizationId: OrganizationId;
  offeringId: OfferingId;
  variantId: string;
  locationId: LocationId;
}): Promise<ServiceOfferingView> {
  const offering = await input.dependencies.offerings.readServiceOffering(input);
  if (offering === undefined || !offering.isActive) {
    throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  }
  if (offering.service.bookingMode === BOOKING_MODE.WALK_IN_ONLY) {
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
  offering: ServiceOfferingView;
}): Promise<{
  line: NonNullable<Awaited<ReturnType<PriceQuoterPort["quote"]>>["lines"][0]>;
  depositRequired: ReturnType<typeof computeDepositRequired>;
}> {
  const settings = await input.dependencies.settings.read(input.organizationId);
  const quote = await input.dependencies.quoter.quote({
    organizationId: input.organizationId,
    locationId: input.locationId,
    offeringId: input.offeringId,
    variantId: input.variantId,
  });
  const line = quote.lines[0];
  if (line === undefined) throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
  const depositRequired = computeDepositRequired({
    orgMode: settings.depositRequired,
    orgValue: settings.depositValue,
    offeringRule: input.offering.service.depositRule,
    lineTotal: line.lineNetTotal,
  });
  return { line, depositRequired };
}
