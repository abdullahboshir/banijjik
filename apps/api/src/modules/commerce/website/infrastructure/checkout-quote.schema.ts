import { Schema, type Document } from "mongoose";
import type { CheckoutQuote } from "../domain/checkout-types.js";

export const CHECKOUT_QUOTE_MODEL_NAME = "WebsiteCheckoutQuote";
export const CHECKOUT_QUOTE_COLLECTION_NAME = "website_checkout_quotes";

export interface CheckoutQuoteDocument extends Document, Omit<CheckoutQuote, "quoteId"> {
  readonly quoteId: string;
}

export const checkoutQuoteSchema = new Schema<CheckoutQuoteDocument>(
  {
    quoteId: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true, immutable: true },
    principalKey: { type: String, required: true, immutable: true },
    input: { type: Schema.Types.Mixed, required: true },
    inputHash: { type: String, required: true },
    pricedSnapshot: { type: Schema.Types.Mixed, required: true },
    configVersion: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    consumedCheckoutId: { type: String, default: null },
    version: { type: Number, default: 1 },
  },
  {
    collection: CHECKOUT_QUOTE_COLLECTION_NAME,
    timestamps: true,
  },
);

checkoutQuoteSchema.index({ organizationId: 1, quoteId: 1 }, { unique: true });
checkoutQuoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
