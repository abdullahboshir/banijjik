import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  promotionArchiveRequestSchema,
  promotionCreateRequestSchema,
  promotionIdParamsSchema,
  promotionListQuerySchema,
  promotionUpdateRequestSchema,
  quoteRequestSchema,
  taxClassArchiveRequestSchema,
  taxClassCreateRequestSchema,
  taxClassIdParamsSchema,
  taxClassListQuerySchema,
  taxClassUpdateRequestSchema,
} from "@banijjik/validation/pricing";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type {
  PromotionController,
  QuoteController,
  TaxClassController,
} from "./pricing.controllers.js";

export interface PricingRouterDependencies {
  readonly taxClasses: TaxClassController;
  readonly promotions: PromotionController;
  readonly quotes: QuoteController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

function mountTaxClassRoutes(router: Router, input: PricingRouterDependencies): void {
  const { taxClasses, permission, idempotency } = input;
  router.get(
    "/tax-classes",
    permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    validate({ query: taxClassListQuerySchema }),
    taxClasses.list,
  );
  router.get(
    "/tax-classes/:taxClassId",
    permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    validate({ params: taxClassIdParamsSchema }),
    taxClasses.get,
  );
  router.post(
    "/tax-classes",
    permission(PERMISSION_KEY.PRICING_TAX_CLASS_UPDATE),
    validate({ body: taxClassCreateRequestSchema }),
    idempotency,
    taxClasses.create,
  );
  router.patch(
    "/tax-classes/:taxClassId",
    permission(PERMISSION_KEY.PRICING_TAX_CLASS_UPDATE),
    validate({ params: taxClassIdParamsSchema, body: taxClassUpdateRequestSchema }),
    taxClasses.update,
  );
  router.post(
    "/tax-classes/:taxClassId/archive",
    permission(PERMISSION_KEY.PRICING_TAX_CLASS_UPDATE),
    validate({ params: taxClassIdParamsSchema, body: taxClassArchiveRequestSchema }),
    taxClasses.archive,
  );
}

function mountPromotionRoutes(router: Router, input: PricingRouterDependencies): void {
  const { promotions, permission, idempotency } = input;
  router.get(
    "/promotions",
    permission(PERMISSION_KEY.PRICING_PROMOTION_READ),
    validate({ query: promotionListQuerySchema }),
    promotions.list,
  );
  router.get(
    "/promotions/:promotionId",
    permission(PERMISSION_KEY.PRICING_PROMOTION_READ),
    validate({ params: promotionIdParamsSchema }),
    promotions.get,
  );
  router.post(
    "/promotions",
    permission(PERMISSION_KEY.PRICING_PROMOTION_CREATE),
    validate({ body: promotionCreateRequestSchema }),
    idempotency,
    promotions.create,
  );
  router.patch(
    "/promotions/:promotionId",
    permission(PERMISSION_KEY.PRICING_PROMOTION_UPDATE),
    validate({ params: promotionIdParamsSchema, body: promotionUpdateRequestSchema }),
    promotions.update,
  );
  router.post(
    "/promotions/:promotionId/archive",
    permission(PERMISSION_KEY.PRICING_PROMOTION_ARCHIVE),
    validate({ params: promotionIdParamsSchema, body: promotionArchiveRequestSchema }),
    promotions.archive,
  );
}

/** Pricing routes of `/orgs/{organizationId}` (card 3.4). */
export function buildPricingTenantRouter(input: PricingRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountTaxClassRoutes(router, input);
  mountPromotionRoutes(router, input);
  router.post(
    "/quotes",
    input.permission(PERMISSION_KEY.CATALOG_OFFERING_READ),
    validate({ body: quoteRequestSchema }),
    input.quotes.create,
  );
  return router;
}
