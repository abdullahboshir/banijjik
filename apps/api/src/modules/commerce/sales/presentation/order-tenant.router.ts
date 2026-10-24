import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  orderIdParamsSchema,
  orderCancelRequestSchema,
  orderCreateRequestSchema,
  orderDeleteQuerySchema,
  orderInstantRequestSchema,
  orderListQuerySchema,
  salesPerformersQuerySchema,
  orderPlaceRequestSchema,
  orderTransitionRequestSchema,
  orderUpdateRequestSchema,
} from "@banijjik/validation/sales";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { OrderController } from "./order.controller.js";

export interface OrderRouterDependencies {
  readonly controller: OrderController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

function mountOrderReadRoutes(input: {
  router: Router;
  controller: OrderController;
  permission: PermissionMiddlewareFactory;
}): void {
  input.router.get(
    "/orders",
    input.permission(PERMISSION_KEY.SALES_ORDER_READ),
    validate({ query: orderListQuerySchema }),
    input.controller.list,
  );
  input.router.get(
    "/sales/performers",
    input.permission(PERMISSION_KEY.SALES_ORDER_CREATE),
    validate({ query: salesPerformersQuerySchema }),
    input.controller.performers,
  );
  input.router.get(
    "/orders/:orderId",
    input.permission(PERMISSION_KEY.SALES_ORDER_READ),
    validate({ params: orderIdParamsSchema }),
    input.controller.get,
  );
}

/** `place` and `instant` move stock and money, so both require an `Idempotency-Key` (ADR-014). */
function mountOrderWriteRoutes(input: {
  router: Router;
  controller: OrderController;
  permission: PermissionMiddlewareFactory;
  idempotency: RequestHandler;
}): void {
  input.router.post(
    "/orders",
    input.permission(PERMISSION_KEY.SALES_ORDER_CREATE),
    validate({ body: orderCreateRequestSchema }),
    input.controller.create,
  );
  input.router.post(
    "/orders/instant",
    input.permission(PERMISSION_KEY.SALES_ORDER_CREATE),
    validate({ body: orderInstantRequestSchema }),
    input.idempotency,
    input.controller.instant,
  );
  input.router.patch(
    "/orders/:orderId",
    input.permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: orderUpdateRequestSchema }),
    input.controller.update,
  );
  input.router.delete(
    "/orders/:orderId",
    input.permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, query: orderDeleteQuerySchema }),
    input.controller.deleteDraft,
  );
  input.router.post(
    "/orders/:orderId/place",
    input.permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: orderPlaceRequestSchema }),
    input.idempotency,
    input.controller.place,
  );
}

function mountOrderTransitionRoutes(input: {
  router: Router;
  controller: OrderController;
  permission: PermissionMiddlewareFactory;
}): void {
  input.router.post(
    "/orders/:orderId/confirm",
    input.permission(PERMISSION_KEY.SALES_ORDER_CONFIRM),
    validate({ params: orderIdParamsSchema, body: orderTransitionRequestSchema }),
    input.controller.confirm,
  );
  input.router.post(
    "/orders/:orderId/pack",
    input.permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: orderTransitionRequestSchema }),
    input.controller.pack,
  );
  input.router.post(
    "/orders/:orderId/complete",
    input.permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: orderTransitionRequestSchema }),
    input.controller.complete,
  );
  input.router.post(
    "/orders/:orderId/cancel",
    input.permission(PERMISSION_KEY.SALES_ORDER_CANCEL),
    validate({ params: orderIdParamsSchema, body: orderCancelRequestSchema }),
    input.controller.cancel,
  );
}

export function buildSalesTenantRouter(input: OrderRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  const mount = {
    router,
    controller: input.controller,
    permission: input.permission,
    idempotency: input.idempotency,
  };
  mountOrderReadRoutes(mount);
  mountOrderWriteRoutes(mount);
  mountOrderTransitionRoutes(mount);
  return router;
}
