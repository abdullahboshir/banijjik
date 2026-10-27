import type {
  OrderCancelBody,
  OrderCreateBody,
  OrderDeleteQuery,
  OrderInstantBody,
  OrderListQuery,
  OrderPlaceBody,
  OrderTransitionBody,
  SalesPerformersQuery,
} from "@banijjik/validation/sales";
import { asId, type OrderId, type UserId } from "@banijjik/ids";
import type { RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  CreateOrderUseCase,
  OrderWriteInput,
} from "../application/use-cases/create-order.use-case.js";
import type { DeleteDraftUseCase } from "../application/use-cases/delete-draft.use-case.js";
import type { InstantOrderUseCase } from "../application/use-cases/instant-order.use-case.js";
import type { PlaceOrderUseCase } from "../application/use-cases/place-order.use-case.js";
import type { ListPerformersUseCase } from "../application/use-cases/list-performers.use-case.js";
import type {
  GetOrderUseCase,
  ListOrdersUseCase,
} from "../application/use-cases/read-order.use-cases.js";
import type {
  CancelOrderUseCase,
  CompleteOrderUseCase,
  ConfirmOrderUseCase,
  PackOrderUseCase,
} from "../application/use-cases/transition-order.use-cases.js";
import type {
  UpdateOrderUseCase,
  UpdateBody,
} from "../application/use-cases/update-order.use-case.js";

const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

/** The query `validate` parsed for the performers lookup (response.locals, not the read-only request.query). */
function readPerformersQuery(response: Response): SalesPerformersQuery {
  return response.locals["validated"].query as SalesPerformersQuery;
}

function readOrderDeleteQuery(response: Response): OrderDeleteQuery {
  return response.locals["validated"].query as OrderDeleteQuery;
}

function readOrderListQuery(response: Response): OrderListQuery {
  return response.locals["validated"].query as OrderListQuery;
}

function orderIdOf(request: Parameters<RequestHandler>[0]): OrderId {
  return asId<OrderId>(String(request.params.orderId));
}

export class OrderController {
  constructor(
    private readonly useCases: {
      readonly createOrder: CreateOrderUseCase;
      readonly updateOrder: UpdateOrderUseCase;
      readonly deleteDraft: DeleteDraftUseCase;
      readonly placeOrder: PlaceOrderUseCase;
      readonly instantOrder: InstantOrderUseCase;
      readonly confirmOrder: ConfirmOrderUseCase;
      readonly packOrder: PackOrderUseCase;
      readonly completeOrder: CompleteOrderUseCase;
      readonly cancelOrder: CancelOrderUseCase;
      readonly getOrder: GetOrderUseCase;
      readonly listOrders: ListOrdersUseCase;
      readonly listPerformers: ListPerformersUseCase;
    },
  ) {}

  readonly create: RequestHandler = async (request, response) => {
    const created = await this.useCases.createOrder.execute({
      ...callerOf(),
      body: request.body as OrderCreateBody,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly instant: RequestHandler = async (request, response) => {
    const completed = await this.useCases.instantOrder.execute({
      ...callerOf(),
      body: request.body as OrderInstantBody,
    });
    sendData(response, completed, { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    sendData(
      response,
      await this.useCases.updateOrder.execute({
        ...callerOf(),
        orderId: orderIdOf(request),
        body: request.body as UpdateBody,
      }),
    );
  };

  readonly deleteDraft: RequestHandler = async (request, response) => {
    const { allowedLocationIds } = readTenantCaller();
    const query = readOrderDeleteQuery(response);
    await this.useCases.deleteDraft.execute({
      orderId: orderIdOf(request),
      version: query.version,
      allowedLocationIds,
    });
    response.status(HTTP_NO_CONTENT).end();
  };

  readonly place: RequestHandler = async (request, response) => {
    const caller = callerOf();
    sendData(
      response,
      await this.useCases.placeOrder.execute({
        ...caller,
        orderId: orderIdOf(request),
        body: request.body as OrderPlaceBody,
      }),
    );
  };

  readonly confirm: RequestHandler = async (request, response) => {
    const caller = callerOf();
    sendData(
      response,
      await this.useCases.confirmOrder.execute({
        ...caller,
        orderId: orderIdOf(request),
        body: request.body as OrderTransitionBody,
      }),
    );
  };

  readonly pack: RequestHandler = async (request, response) => {
    const caller = callerOf();
    sendData(
      response,
      await this.useCases.packOrder.execute({
        ...caller,
        orderId: orderIdOf(request),
        body: request.body as OrderTransitionBody,
      }),
    );
  };

  readonly complete: RequestHandler = async (request, response) => {
    const caller = callerOf();
    sendData(
      response,
      await this.useCases.completeOrder.execute({
        ...caller,
        orderId: orderIdOf(request),
        body: request.body as OrderTransitionBody,
      }),
    );
  };

  readonly cancel: RequestHandler = async (request, response) => {
    const caller = callerOf();
    const body = request.body as OrderCancelBody;
    sendData(
      response,
      await this.useCases.cancelOrder.execute({
        ...caller,
        orderId: orderIdOf(request),
        body: { version: body.version },
        reason: body.reason,
      }),
    );
  };

  readonly get: RequestHandler = async (request, response) => {
    const caller = callerOf();
    sendData(
      response,
      await this.useCases.getOrder.execute({ ...caller, orderId: orderIdOf(request) }),
    );
  };

  readonly list: RequestHandler = async (request, response) => {
    const caller = callerOf();
    const query = readOrderListQuery(response);
    const page = await this.useCases.listOrders.execute({ ...caller, query });
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly performers: RequestHandler = async (request, response) => {
    const { allowedLocationIds } = readTenantCaller();
    const query = readPerformersQuery(response);
    sendData(response, await this.useCases.listPerformers.execute({ allowedLocationIds, query }));
  };
}

/** Every order route runs inside the tenant pipeline, so the caller is always a real user. */
function callerOf(): OrderWriteInput & { readonly actorUserId: UserId } {
  const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
  return { organizationId, actorUserId, allowedLocationIds };
}
