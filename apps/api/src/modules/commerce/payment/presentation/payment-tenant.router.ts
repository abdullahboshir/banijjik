import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  adjustStoreCreditRequestSchema,
  listDuesQuerySchema,
  listPaymentsQuerySchema,
  listStoreCreditEntriesQuerySchema,
  paymentIdParamsSchema,
  receivePaymentRequestSchema,
  refundPaymentRequestSchema,
  reversePaymentRequestSchema,
} from "@banijjik/validation/payment";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { PaymentController } from "./payment.controller.js";

export interface PaymentRouterDependencies {
  readonly controller: PaymentController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

function mountPaymentRoutes(router: Router, input: PaymentRouterDependencies): void {
  router.post(
    "/payments",
    input.permission(PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE),
    input.idempotency,
    validate({ body: receivePaymentRequestSchema }),
    input.controller.receive,
  );

  router.get(
    "/payments",
    input.permission(PERMISSION_KEY.PAYMENT_PAYMENT_READ),
    validate({ query: listPaymentsQuerySchema }),
    input.controller.list,
  );

  router.get(
    "/payments/:paymentId",
    input.permission(PERMISSION_KEY.PAYMENT_PAYMENT_READ),
    validate({ params: paymentIdParamsSchema }),
    input.controller.get,
  );

  router.post(
    "/payments/:paymentId/refund",
    input.permission(PERMISSION_KEY.PAYMENT_PAYMENT_REFUND),
    input.idempotency,
    validate({
      params: paymentIdParamsSchema,
      body: refundPaymentRequestSchema,
    }),
    input.controller.refund,
  );

  router.post(
    "/payments/:paymentId/reverse",
    input.permission(PERMISSION_KEY.PAYMENT_PAYMENT_REVERSE),
    input.idempotency,
    validate({
      params: paymentIdParamsSchema,
      body: reversePaymentRequestSchema,
    }),
    input.controller.reverse,
  );
}

function mountStoreCreditAndDuesRoutes(router: Router, input: PaymentRouterDependencies): void {
  router.get(
    "/dues",
    input.permission(PERMISSION_KEY.PAYMENT_DUE_READ),
    validate({ query: listDuesQuerySchema }),
    input.controller.dues,
  );

  router.post(
    "/store-credit/adjustments",
    input.permission(PERMISSION_KEY.PAYMENT_STORE_CREDIT_ADJUST),
    input.idempotency,
    validate({ body: adjustStoreCreditRequestSchema }),
    input.controller.adjustCredit,
  );

  router.get(
    "/store-credit",
    input.permission(PERMISSION_KEY.PAYMENT_STORE_CREDIT_READ),
    validate({ query: listStoreCreditEntriesQuerySchema }),
    input.controller.listCredit,
  );
}

export function buildPaymentTenantRouter(input: PaymentRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountPaymentRoutes(router, input);
  mountStoreCreditAndDuesRoutes(router, input);
  return router;
}
