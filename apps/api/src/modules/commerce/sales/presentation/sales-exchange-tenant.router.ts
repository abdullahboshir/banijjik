import { PERMISSION_KEY } from "@banijjik/contracts";
import { orderIdParamsSchema, salesExchangeRequestSchema } from "@banijjik/validation/sales";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SalesExchangeController } from "./sales-exchange.controller.js";

export interface SalesExchangeRouterDependencies {
  readonly controller: SalesExchangeController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/**
 * Exchanges on the tenant pipeline (plan 3.5b E1). An exchange takes a return and sells a new order,
 * so it needs both the return and the order permission. The create moves money and stock and
 * requires an `Idempotency-Key`; the preview writes nothing and needs none.
 */
export function buildSalesExchangeTenantRouter(input: SalesExchangeRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission, idempotency } = input;
  router.post(
    "/orders/:orderId/exchange/preview",
    permission(PERMISSION_KEY.SALES_RETURN_CREATE),
    permission(PERMISSION_KEY.SALES_ORDER_CREATE),
    validate({ params: orderIdParamsSchema, body: salesExchangeRequestSchema }),
    controller.preview,
  );
  router.post(
    "/orders/:orderId/exchange",
    permission(PERMISSION_KEY.SALES_RETURN_CREATE),
    permission(PERMISSION_KEY.SALES_ORDER_CREATE),
    validate({ params: orderIdParamsSchema, body: salesExchangeRequestSchema }),
    idempotency,
    controller.create,
  );
  return router;
}
