import { Schema, type Document } from "mongoose";
import type { Checkout, CheckoutRequestLinkRecord } from "../domain/checkout-types.js";

export const CHECKOUT_MODEL_NAME = "WebsiteCheckout";
export const CHECKOUT_COLLECTION_NAME = "website_checkouts";

export interface CheckoutDocument extends Document, Omit<Checkout, "checkoutId"> {
  readonly checkoutId: string;
}

export const checkoutSchema = new Schema<CheckoutDocument>(
  {
    checkoutId: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    creationPrincipalKey: { type: String, required: true, immutable: true },
    contactId: { type: String, required: true, immutable: true },
    contactSnapshot: { type: Schema.Types.Mixed, required: true },
    quoteId: { type: String, required: true, immutable: true },
    acceptedTotals: { type: Schema.Types.Mixed, required: true },
    idempotencyKeyHash: { type: String, required: true, immutable: true },
    inputHash: { type: String, required: true },
    version: { type: Number, default: 1 },
  },
  {
    collection: CHECKOUT_COLLECTION_NAME,
    timestamps: true,
  },
);

checkoutSchema.index({ organizationId: 1, checkoutId: 1 }, { unique: true });
checkoutSchema.index(
  { organizationId: 1, creationPrincipalKey: 1, idempotencyKeyHash: 1 },
  { unique: true },
);
checkoutSchema.index({ organizationId: 1, quoteId: 1 }, { unique: true });

export const CHECKOUT_REQUEST_LINK_MODEL_NAME = "WebsiteCheckoutRequestLink";
export const CHECKOUT_REQUEST_LINK_COLLECTION_NAME = "website_checkout_request_links";

export interface CheckoutRequestLinkDocument
  extends Document, Omit<CheckoutRequestLinkRecord, "checkoutRequestLinkId"> {
  readonly checkoutRequestLinkId: string;
}

export const checkoutRequestLinkSchema = new Schema<CheckoutRequestLinkDocument>(
  {
    checkoutRequestLinkId: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true, immutable: true },
    checkoutId: { type: String, required: true, immutable: true },
    selectionIds: [{ type: String, required: true }],
    requestType: { type: String, required: true, enum: ["ORDER", "BOOKING", "ENROLLMENT"] },
    requestId: { type: String, required: true, immutable: true },
    publicNumber: { type: String, default: null },
    status: { type: String, required: true },
    paymentRequired: { type: Schema.Types.Mixed, required: true },
    holdExpiresAt: { type: Date, default: null },
    ownerType: { type: String, required: true, enum: ["CUSTOMER", "GUEST"] },
    ownerIdentifier: { type: String, required: true },
    revokedAt: { type: Date, default: null },
  },
  {
    collection: CHECKOUT_REQUEST_LINK_COLLECTION_NAME,
    timestamps: true,
  },
);

checkoutRequestLinkSchema.index({ organizationId: 1, checkoutRequestLinkId: 1 }, { unique: true });
checkoutRequestLinkSchema.index(
  { organizationId: 1, requestType: 1, requestId: 1 },
  { unique: true },
);
checkoutRequestLinkSchema.index({
  organizationId: 1,
  checkoutId: 1,
  requestType: 1,
  requestId: 1,
});
checkoutRequestLinkSchema.index({
  organizationId: 1,
  checkoutId: 1,
  createdAt: -1,
  checkoutRequestLinkId: 1,
});
checkoutRequestLinkSchema.index({
  organizationId: 1,
  ownerType: 1,
  ownerIdentifier: 1,
  revokedAt: 1,
  createdAt: -1,
  checkoutRequestLinkId: 1,
});
