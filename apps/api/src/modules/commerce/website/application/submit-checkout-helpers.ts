import { ERROR_CODE } from "@banijjik/contracts";
import type {
  CheckoutPrincipal,
  CheckoutRequest,
  CheckoutRequestLink,
  CheckoutResponse,
} from "@banijjik/contracts/website";
import { AppError } from "../../../../kernel/http/index.js";
import type { CheckoutQuote, CheckoutRequestLinkRecord } from "../domain/checkout-types.js";
import type {
  CheckoutAccessRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
  PublicBookingCommands,
  PublicEnrollmentCommands,
  PublicOrderCommands,
  StorefrontOrganizationConfig,
} from "./checkout-ports.js";

export function toLinkDto(record: CheckoutRequestLinkRecord): CheckoutRequestLink {
  return {
    selectionIds: record.selectionIds,
    requestType: record.requestType,
    requestId: record.requestId,
    publicNumber: record.publicNumber,
    status: record.status,
    paymentRequired: record.paymentRequired,
    holdExpiresAt: record.holdExpiresAt ? record.holdExpiresAt.toISOString() : null,
  };
}

export async function checkIdempotentReplay(deps: {
  readonly checkouts: CheckoutRepositoryPort;
  readonly access: CheckoutAccessRepositoryPort;
  readonly requestLinks: CheckoutRequestLinkRepositoryPort;
  readonly input: {
    readonly organizationId: string;
    readonly creationPrincipalKey: string;
    readonly idempotencyKeyHash: string;
    readonly inputHash: string;
    readonly principal: CheckoutPrincipal;
  };
}): Promise<CheckoutResponse | null> {
  const { checkouts, access, requestLinks, input } = deps;
  const existing = await checkouts.findByIdempotencyKey(
    input.organizationId,
    input.creationPrincipalKey,
    input.idempotencyKeyHash,
  );
  if (!existing) return null;

  if (existing.inputHash !== input.inputHash) {
    throw new AppError({
      code: ERROR_CODE.IDEMPOTENCY_MISMATCH,
      messageKey: "errors.idempotency_mismatch",
    });
  }

  const accessRecord = await access.findByCheckoutId(input.organizationId, existing.checkoutId);
  if (!accessRecord || accessRecord.revokedAt !== null) {
    throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
  }

  const expectedOwnerId =
    input.principal.type === "CUSTOMER"
      ? input.principal.customerAccountId
      : input.principal.guestSessionId;
  if (
    accessRecord.owner.type !== input.principal.type ||
    accessRecord.owner.identifier !== expectedOwnerId
  ) {
    throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
  }

  const links = await requestLinks.listByCheckoutId(input.organizationId, existing.checkoutId);
  return {
    checkoutId: existing.checkoutId,
    locationId: existing.locationId,
    total: existing.acceptedTotals.total,
    requests: links.map(toLinkDto),
  };
}

export function assertQuoteValid(
  quote: CheckoutQuote | null,
  principalKey: string,
  now: Date,
): CheckoutQuote {
  if (!quote || quote.expiresAt.getTime() <= now.getTime()) {
    throw new AppError({
      code: ERROR_CODE.CHECKOUT_QUOTE_EXPIRED,
      messageKey: "errors.checkout_quote_expired",
    });
  }
  if (quote.principalKey !== principalKey) {
    throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
  }
  if (quote.consumedAt !== null) {
    throw new AppError({ code: ERROR_CODE.CONFLICT, messageKey: "errors.conflict" });
  }
  return quote;
}

export function assertStorefrontEligible(
  config: StorefrontOrganizationConfig,
  locationId: string,
  quoteVersion: number,
): void {
  if (config.isReadOnly) {
    throw new AppError({ code: ERROR_CODE.ORG_READ_ONLY, messageKey: "errors.org_read_only" });
  }
  if (config.isSuspended) {
    throw new AppError({ code: ERROR_CODE.ORG_SUSPENDED, messageKey: "errors.org_suspended" });
  }
  if (!config.checkoutEnabled) {
    throw new AppError({
      code: ERROR_CODE.CHECKOUT_NOT_AVAILABLE,
      messageKey: "errors.checkout_not_available",
    });
  }
  if (config.publicLocationIds.length > 0 && !config.publicLocationIds.includes(locationId)) {
    throw new AppError({
      code: ERROR_CODE.CHECKOUT_LOCATION_MISMATCH,
      messageKey: "errors.checkout_location_mismatch",
    });
  }
  if (config.configVersion !== quoteVersion) {
    throw new AppError({
      code: ERROR_CODE.CHECKOUT_PRICE_CHANGED,
      messageKey: "errors.checkout_price_changed",
    });
  }
}

export async function executeCommands(input: {
  readonly quote: CheckoutQuote;
  readonly body: CheckoutRequest;
  readonly commandContext: {
    readonly organizationId: string;
    readonly locationId: string;
    readonly contactId: string;
    readonly checkoutId: string;
    readonly actorUserId: null;
  };
  readonly commands: {
    readonly publicOrders: PublicOrderCommands;
    readonly publicBookings: PublicBookingCommands;
    readonly publicEnrollments: PublicEnrollmentCommands;
  };
}): Promise<readonly CheckoutRequestLink[]> {
  const { quote, body, commandContext, commands } = input;
  const links: CheckoutRequestLink[] = [];
  const products = quote.input.selections.filter((s) => s.selection.kind === "PRODUCT");
  const bookings = quote.input.selections.filter((s) =>
    ["SERVICE", "RENTAL", "EVENT"].includes(s.selection.kind),
  );
  const plans = quote.input.selections.filter((s) => s.selection.kind === "PLAN");

  if (products.length > 0) {
    const orderLink = await commands.publicOrders.place(commandContext, {
      selections: products,
      recipient: { name: body.contact.name, phoneE164: body.contact.phone },
      fulfillment: quote.input.fulfillment,
    });
    links.push(orderLink);
  }
  for (const sel of bookings) {
    links.push(await commands.publicBookings.request(commandContext, sel));
  }
  for (const sel of plans) {
    links.push(await commands.publicEnrollments.request(commandContext, sel));
  }
  return links;
}
