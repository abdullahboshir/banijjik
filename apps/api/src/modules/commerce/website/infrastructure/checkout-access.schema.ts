import { Schema, type Document } from "mongoose";
import type { CheckoutAccess } from "../domain/checkout-types.js";

export const CHECKOUT_ACCESS_MODEL_NAME = "WebsiteCheckoutAccess";
export const CHECKOUT_ACCESS_COLLECTION_NAME = "website_checkout_access";

export interface CheckoutAccessDocument extends Document, Omit<CheckoutAccess, "checkoutAccessId"> {
  readonly checkoutAccessId: string;
}

const ownerSchema = new Schema(
  {
    type: { type: String, required: true, enum: ["CUSTOMER", "GUEST"] },
    identifier: { type: String, required: true },
  },
  { _id: false },
);

export const checkoutAccessSchema = new Schema<CheckoutAccessDocument>(
  {
    checkoutAccessId: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true, immutable: true },
    checkoutId: { type: String, required: true, immutable: true },
    owner: { type: ownerSchema, required: true },
    revokedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
  },
  {
    collection: CHECKOUT_ACCESS_COLLECTION_NAME,
    timestamps: true,
  },
);

checkoutAccessSchema.index({ organizationId: 1, checkoutAccessId: 1 }, { unique: true });
checkoutAccessSchema.index({ organizationId: 1, checkoutId: 1 }, { unique: true });
checkoutAccessSchema.index({
  organizationId: 1,
  "owner.type": 1,
  "owner.identifier": 1,
  revokedAt: 1,
  createdAt: -1,
  checkoutId: 1,
});
