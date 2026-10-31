import type {
  Checkout,
  CheckoutAccess,
  CheckoutAccessOwner,
  CheckoutQuote,
  CheckoutRequestLinkRecord,
} from "../domain/checkout-types.js";
import type { CheckoutAccessDocument } from "./checkout-access.schema.js";
import type { CheckoutQuoteDocument } from "./checkout-quote.schema.js";
import type { CheckoutDocument, CheckoutRequestLinkDocument } from "./checkout.schema.js";

interface WithAudit {
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export function toQuote(doc: CheckoutQuoteDocument): CheckoutQuote {
  const audit = doc as unknown as WithAudit;
  return {
    quoteId: doc.quoteId,
    organizationId: doc.organizationId,
    principalKey: doc.principalKey,
    input: doc.input,
    inputHash: doc.inputHash,
    pricedSnapshot: doc.pricedSnapshot,
    configVersion: doc.configVersion,
    expiresAt: doc.expiresAt,
    consumedAt: doc.consumedAt ?? null,
    consumedCheckoutId: doc.consumedCheckoutId ?? null,
    version: doc.version,
    createdAt: audit.createdAt ?? new Date(),
    updatedAt: audit.updatedAt ?? new Date(),
  };
}

export function toCheckout(doc: CheckoutDocument): Checkout {
  const audit = doc as unknown as WithAudit;
  return {
    checkoutId: doc.checkoutId,
    organizationId: doc.organizationId,
    locationId: doc.locationId,
    creationPrincipalKey: doc.creationPrincipalKey,
    contactId: doc.contactId,
    contactSnapshot: doc.contactSnapshot,
    quoteId: doc.quoteId,
    acceptedTotals: doc.acceptedTotals,
    idempotencyKeyHash: doc.idempotencyKeyHash,
    inputHash: doc.inputHash,
    version: doc.version,
    createdAt: audit.createdAt ?? new Date(),
    updatedAt: audit.updatedAt ?? new Date(),
  };
}

export function toCheckoutAccess(doc: CheckoutAccessDocument): CheckoutAccess {
  const audit = doc as unknown as WithAudit;
  return {
    checkoutAccessId: doc.checkoutAccessId,
    organizationId: doc.organizationId,
    checkoutId: doc.checkoutId,
    owner: doc.owner as CheckoutAccessOwner,
    revokedAt: doc.revokedAt ?? null,
    version: doc.version,
    createdAt: audit.createdAt ?? new Date(),
    updatedAt: audit.updatedAt ?? new Date(),
  };
}

export function toCheckoutRequestLink(doc: CheckoutRequestLinkDocument): CheckoutRequestLinkRecord {
  const audit = doc as unknown as WithAudit;
  return {
    checkoutRequestLinkId: doc.checkoutRequestLinkId,
    organizationId: doc.organizationId,
    checkoutId: doc.checkoutId,
    selectionIds: doc.selectionIds,
    requestType: doc.requestType as "ORDER" | "BOOKING" | "ENROLLMENT",
    requestId: doc.requestId,
    publicNumber: doc.publicNumber ?? null,
    status: doc.status,
    paymentRequired: doc.paymentRequired,
    holdExpiresAt: doc.holdExpiresAt ?? null,
    createdAt: audit.createdAt ?? new Date(),
    updatedAt: audit.updatedAt ?? new Date(),
  };
}
