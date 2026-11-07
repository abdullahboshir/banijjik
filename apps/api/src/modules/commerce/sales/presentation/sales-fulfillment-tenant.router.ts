import { PERMISSION_KEY } from "@banijjik/contracts";
import type { DeliveryAttempt } from "@banijjik/contracts/sales/delivery";
import { asId, type OrderId } from "@banijjik/ids";
import { paginationQuerySchema, type PaginationQuery } from "@banijjik/validation";
import { orderIdParamsSchema } from "@banijjik/validation/sales";
import {
  deliverOrderRequestSchema,
  deliveryFailedRequestSchema,
  receiveRtsRequestSchema,
  reconcileDeliveryLossRequestSchema,
  recoverDeliveryLossRequestSchema,
  shipOrderRequestSchema,
  type DeliverOrderBody,
  type DeliveryFailedBody,
  type ReceiveRtsBody,
  type ReconcileDeliveryLossBody,
  type RecoverDeliveryLossBody,
  type ShipOrderBody,
} from "@banijjik/validation/sales/delivery";
import { Router, type RequestHandler } from "express";
import { readTenantCaller, type PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type { DeliverOrderUseCase } from "../application/use-cases/deliver-order.use-case.js";
import type { FailDeliveryUseCase } from "../application/use-cases/fail-delivery.use-case.js";
import type { ListDeliveryAttemptsUseCase } from "../application/use-cases/list-delivery-attempts.use-case.js";
import type { ReceiveRtsUseCase } from "../application/use-cases/receive-rts.use-case.js";
import type { ReconcileDeliveryLossUseCase } from "../application/use-cases/reconcile-delivery-loss.use-case.js";
import type { RecoverDeliveryLossUseCase } from "../application/use-cases/recover-delivery-loss.use-case.js";
import type { GetDeliveryLossUseCase } from "../application/use-cases/get-delivery-loss.use-case.js";
import type { ReshipOrderUseCase } from "../application/use-cases/ship-order.use-cases.js";

function toDeliveryAttemptResponse(attempt: DeliveryAttempt) {
  return {
    deliveryAttemptId: attempt.deliveryAttemptId,
    organizationId: attempt.organizationId,
    orderId: attempt.orderId,
    ordinal: attempt.ordinal,
    method: attempt.method,
    consignmentId: attempt.consignmentId,
    deliveryAssignmentId: attempt.deliveryAssignmentId,
    startedAt: attempt.startedAt.toISOString(),
    failedAt: attempt.failedAt === null ? null : attempt.failedAt.toISOString(),
    reasonKey: attempt.reasonKey,
    note: attempt.note,
    version: attempt.version,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
    createdByUserId: attempt.createdByUserId,
    updatedByUserId: attempt.updatedByUserId,
  };
}

export interface SalesFulfillmentController {
  readonly failDelivery: RequestHandler;
  readonly reshipOrder: RequestHandler;
  readonly receiveRts: RequestHandler;
  readonly deliverOrder: RequestHandler;
  readonly listDeliveryAttempts: RequestHandler;
  readonly closeDeliveryLoss: RequestHandler;
  readonly recoverDeliveryLoss: RequestHandler;
  readonly getDeliveryLoss: RequestHandler;
}

export interface SalesFulfillmentRouterDependencies {
  readonly controller: SalesFulfillmentController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

export class SalesFulfillmentHttpController implements SalesFulfillmentController {
  constructor(
    private readonly useCases: {
      readonly fail: FailDeliveryUseCase;
      readonly reship: ReshipOrderUseCase;
      readonly receiveRts: ReceiveRtsUseCase;
      readonly deliver: DeliverOrderUseCase;
      readonly list: ListDeliveryAttemptsUseCase;
      readonly closeLoss: ReconcileDeliveryLossUseCase;
      readonly recoverLoss: RecoverDeliveryLossUseCase;
      readonly getLoss: GetDeliveryLossUseCase;
    },
  ) {}

  readonly failDelivery: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const body = response.locals["validated"].body as DeliveryFailedBody;
    sendData(
      response,
      await this.useCases.fail.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: asId<OrderId>(params.orderId),
        body: {
          version: body.version,
          reasonKey: body.reasonKey,
          ...(body.note === undefined ? {} : { note: body.note }),
        },
      }),
    );
  };

  readonly receiveRts: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const body = response.locals["validated"].body as ReceiveRtsBody;
    sendData(
      response,
      await this.useCases.receiveRts.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: asId<OrderId>(params.orderId),
        body,
      }),
    );
  };

  readonly deliverOrder: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const body = response.locals["validated"].body as DeliverOrderBody;
    sendData(
      response,
      await this.useCases.deliver.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: asId<OrderId>(params.orderId),
        body,
      }),
    );
  };

  readonly reshipOrder: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const body = response.locals["validated"].body as ShipOrderBody;
    sendData(
      response,
      await this.useCases.reship.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: asId<OrderId>(params.orderId),
        body,
      }),
    );
  };

  readonly listDeliveryAttempts: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const query = response.locals["validated"].query as PaginationQuery;
    const page = await this.useCases.list.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      orderId: asId<OrderId>(params.orderId),
      page: query.page,
      limit: query.limit,
    });
    sendData(response, page.items.map(toDeliveryAttemptResponse), {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly closeDeliveryLoss: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const body = response.locals["validated"].body as ReconcileDeliveryLossBody;
    sendData(
      response,
      await this.useCases.closeLoss.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: asId<OrderId>(params.orderId),
        body,
      }),
    );
  };

  readonly recoverDeliveryLoss: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    const body = response.locals["validated"].body as RecoverDeliveryLossBody;
    sendData(
      response,
      await this.useCases.recoverLoss.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: asId<OrderId>(params.orderId),
        body,
      }),
    );
  };

  readonly getDeliveryLoss: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as { readonly orderId: string };
    sendData(
      response,
      await this.useCases.getLoss.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        orderId: asId<OrderId>(params.orderId),
      }),
    );
  };
}

export function buildSalesFulfillmentTenantRouter(
  input: SalesFulfillmentRouterDependencies,
): Router {
  const { controller, permission, idempotency } = input;
  const router = Router({ mergeParams: true });

  router.post(
    "/orders/:orderId/delivery-failed",
    permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: deliveryFailedRequestSchema }),
    idempotency,
    controller.failDelivery,
  );

  router.post(
    "/orders/:orderId/rts",
    permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: receiveRtsRequestSchema }),
    idempotency,
    controller.receiveRts,
  );

  router.post(
    "/orders/:orderId/deliver",
    permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: deliverOrderRequestSchema }),
    idempotency,
    controller.deliverOrder,
  );

  router.post(
    "/orders/:orderId/reship",
    permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: shipOrderRequestSchema }),
    idempotency,
    controller.reshipOrder,
  );

  router.get(
    "/orders/:orderId/delivery-attempts",
    permission(PERMISSION_KEY.SALES_ORDER_READ),
    validate({ params: orderIdParamsSchema, query: paginationQuerySchema }),
    controller.listDeliveryAttempts,
  );

  router.post(
    "/orders/:orderId/delivery-loss/close",
    permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: reconcileDeliveryLossRequestSchema }),
    idempotency,
    controller.closeDeliveryLoss,
  );

  router.post(
    "/orders/:orderId/delivery-loss/recover",
    permission(PERMISSION_KEY.SALES_ORDER_UPDATE),
    validate({ params: orderIdParamsSchema, body: recoverDeliveryLossRequestSchema }),
    idempotency,
    controller.recoverDeliveryLoss,
  );

  router.get(
    "/orders/:orderId/delivery-loss",
    permission(PERMISSION_KEY.SALES_ORDER_READ),
    validate({ params: orderIdParamsSchema }),
    controller.getDeliveryLoss,
  );

  return router;
}
