import type { SalesExchangeRequestBody } from "@banijjik/validation/sales";
import { asId, type OrderId } from "@banijjik/ids";
import type { RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  CreateSalesExchangeUseCase,
  PreviewSalesExchangeUseCase,
} from "../application/use-cases/sales-exchange.use-cases.js";

const HTTP_CREATED = 201;

export interface SalesExchangeUseCases {
  readonly preview: PreviewSalesExchangeUseCase;
  readonly create: CreateSalesExchangeUseCase;
}

function orderIdOf(params: unknown): OrderId {
  return asId<OrderId>((params as { readonly orderId: string }).orderId);
}

/** Thin HTTP layer: the caller and the validated body go to the use case, which checks the rest. */
export class SalesExchangeController {
  constructor(private readonly useCases: SalesExchangeUseCases) {}

  readonly preview: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    sendData(
      response,
      await this.useCases.preview.execute({
        organizationId: caller.organizationId,
        allowedLocationIds: caller.allowedLocationIds,
        actorUserId: caller.actorUserId,
        orderId: orderIdOf(response.locals["validated"].params),
        body: response.locals["validated"].body as SalesExchangeRequestBody,
      }),
    );
  };

  readonly create: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const exchanged = await this.useCases.create.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      actorUserId: caller.actorUserId,
      orderId: orderIdOf(response.locals["validated"].params),
      body: response.locals["validated"].body as SalesExchangeRequestBody,
    });
    sendData(response, exchanged, { status: HTTP_CREATED });
  };
}
