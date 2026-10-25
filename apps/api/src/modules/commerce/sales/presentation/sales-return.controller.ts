import type {
  SalesReturnListQuery,
  SalesReturnParams,
  SalesReturnRequestBody,
} from "@banijjik/validation/sales";
import { asId, type OrderId, type SalesReturnId } from "@banijjik/ids";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  CreateSalesReturnUseCase,
  GetSalesReturnUseCase,
  ReverseSalesReturnUseCase,
  ListSalesReturnsUseCase,
  PreviewSalesReturnUseCase,
} from "../application/use-cases/sales-return.use-cases.js";

const HTTP_CREATED = 201;

export interface SalesReturnUseCases {
  readonly preview: PreviewSalesReturnUseCase;
  readonly create: CreateSalesReturnUseCase;
  readonly list: ListSalesReturnsUseCase;
  readonly get: GetSalesReturnUseCase;
  readonly reverse: ReverseSalesReturnUseCase;
}

function orderIdOf(params: unknown): OrderId {
  return asId<OrderId>((params as { readonly orderId: string }).orderId);
}

/** Thin HTTP layer: the caller and the validated input go to the use case, which checks the rest. */
export class SalesReturnController {
  constructor(private readonly useCases: SalesReturnUseCases) {}

  readonly preview: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as SalesReturnRequestBody;
    sendData(
      response,
      await this.useCases.preview.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: orderIdOf(response.locals["validated"].params),
        body,
      }),
    );
  };

  readonly create: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as SalesReturnRequestBody;
    const created = await this.useCases.create.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      actorUserId: caller.actorUserId,
      orderId: orderIdOf(response.locals["validated"].params),
      body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly list: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const query = response.locals["validated"].query as SalesReturnListQuery;
    const page = await this.useCases.list.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      ...(query.locationId === undefined ? {} : { locationId: query.locationId }),
      ...(query.orderId === undefined ? {} : { orderId: asId<OrderId>(query.orderId) }),
      ...(query.from === undefined ? {} : { from: query.from }),
      ...(query.to === undefined ? {} : { to: query.to }),
      page: query.page,
      limit: query.limit,
    });
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly get: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as SalesReturnParams;
    sendData(
      response,
      await this.useCases.get.execute({
        salesReturnId: asId<SalesReturnId>(params.salesReturnId),
        allowedLocationIds: caller.allowedLocationIds,
      }),
    );
  };

  readonly reverse: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as SalesReturnParams;
    const body = response.locals["validated"].body;
    if (caller.actorUserId === null) throw new Error("Authenticated actor is required");
    sendData(
      response,
      await this.useCases.reverse.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        salesReturnId: asId<SalesReturnId>(params.salesReturnId),
        body,
      }),
    );
  };
}
