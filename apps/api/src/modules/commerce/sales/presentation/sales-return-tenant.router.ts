import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  orderIdParamsSchema,
  salesReturnListQuerySchema,
  salesReturnParamsSchema,
  salesReturnRequestSchema,
  salesReturnReverseRequestSchema,
} from "@banijjik/validation/sales";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SalesReturnController } from "./sales-return.controller.js";

export interface SalesReturnRouterDependencies {
  readonly controller: SalesReturnController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/**
 * Returns on the tenant pipeline (plan 3.5b decision 11). A create moves money and stock, so it
 * requires an `Idempotency-Key`; a preview writes nothing and needs none.
 */
export function buildSalesReturnTenantRouter(input: SalesReturnRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const { controller, permission, idempotency } = input;
  router.post(
    "/orders/:orderId/returns/preview",
    permission(PERMISSION_KEY.SALES_RETURN_CREATE),
    validate({ params: orderIdParamsSchema, body: salesReturnRequestSchema }),
    controller.preview,
  );
  router.post(
    "/orders/:orderId/returns",
    permission(PERMISSION_KEY.SALES_RETURN_CREATE),
    validate({ params: orderIdParamsSchema, body: salesReturnRequestSchema }),
    idempotency,
    controller.create,
  );
  router.get(
    "/sales/returns",
    permission(PERMISSION_KEY.SALES_RETURN_READ),
    validate({ query: salesReturnListQuerySchema }),
    controller.list,
  );
  router.post(
    "/sales/returns/:salesReturnId/reverse",
    permission(PERMISSION_KEY.SALES_RETURN_REVERSE),
    validate({ params: salesReturnParamsSchema, body: salesReturnReverseRequestSchema }),
    idempotency,
    controller.reverse,
  );
  router.get(
    "/sales/returns/:salesReturnId",
    permission(PERMISSION_KEY.SALES_RETURN_READ),
    validate({ params: salesReturnParamsSchema }),
    controller.get,
  );
  return router;
}
