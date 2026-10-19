/** Events of the pricing module (`<module>.<entity>.<pastTenseVerb>`). Payloads carry ids only. */
export const PRICING_EVENT_TYPE = Object.freeze({
  PROMOTION_CHANGED: "pricing.promotion.changed",
} as const);

export type PricingEventType = (typeof PRICING_EVENT_TYPE)[keyof typeof PRICING_EVENT_TYPE];
