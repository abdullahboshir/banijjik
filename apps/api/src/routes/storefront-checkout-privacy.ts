import {
  MongoCheckoutAccessRepository,
  MongoCheckoutQuoteRepository,
  MongoCheckoutRepository,
  MongoCheckoutRequestLinkRepository,
  buildCheckoutPrivacyParticipants,
  type CheckoutPrivacyParticipants,
} from "../modules/commerce/website/index.js";

export function buildStorefrontCheckoutPrivacyParticipants(): CheckoutPrivacyParticipants {
  return buildCheckoutPrivacyParticipants({
    accesses: new MongoCheckoutAccessRepository(),
    checkouts: new MongoCheckoutRepository(),
    requestLinks: new MongoCheckoutRequestLinkRepository(),
    quotes: new MongoCheckoutQuoteRepository(),
  });
}
