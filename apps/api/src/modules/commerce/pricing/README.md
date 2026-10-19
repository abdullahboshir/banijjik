# pricing

CORE module. One quote pipeline for the whole platform (11 §3, ADR-120): unit price, promotions, manual and order discounts, tax and optional cash rounding. Owns tax classes and promotions-as-data.

Other modules import only through `index.ts` (`PriceQuoter`, `buildPricingRouter`).
