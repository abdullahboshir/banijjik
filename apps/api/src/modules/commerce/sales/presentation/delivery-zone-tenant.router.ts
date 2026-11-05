import { PERMISSION_KEY } from "@banijjik/contracts";
import type { UpdateDeliveryZoneRequest } from "@banijjik/contracts/sales/delivery";
import {
  createDeliveryZoneRequestSchema,
  deliveryZoneIdParamsSchema,
  deliveryZoneListQuerySchema,
  updateDeliveryZoneRequestSchema,
  type CreateDeliveryZoneBody,
  type DeliveryZoneIdParams,
  type DeliveryZoneListQuery,
  type UpdateDeliveryZoneBody,
} from "@banijjik/validation/sales/delivery";
import { Router, type RequestHandler } from "express";
import {
  readTenantCaller,
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type { ManageDeliveryZonesUseCase } from "../application/use-cases/manage-delivery-zones.use-case.js";

const HTTP_CREATED = 201;

function updateRequestOf(body: UpdateDeliveryZoneBody): UpdateDeliveryZoneRequest {
  return {
    version: body.version,
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.areaCodes === undefined ? {} : { areaCodes: body.areaCodes }),
    ...(body.feeMinor === undefined ? {} : { feeMinor: body.feeMinor }),
    ...(body.status === undefined ? {} : { status: body.status }),
  };
}

export interface DeliveryZoneController {
  readonly list: RequestHandler;
  readonly create: RequestHandler;
  readonly get: RequestHandler;
  readonly update: RequestHandler;
}

export interface DeliveryZoneRouterDependencies {
  readonly controller: DeliveryZoneController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/** Thin HTTP layer: the caller and the validated input go to the use case. */
export class DeliveryZoneHttpController implements DeliveryZoneController {
  constructor(private readonly useCases: ManageDeliveryZonesUseCase) {}

  readonly list: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const query = response.locals["validated"].query as DeliveryZoneListQuery;
    const page = await this.useCases.list({
      organizationId: caller.organizationId,
      actorUserId: caller.actorUserId,
      page: query.page,
      limit: query.limit,
    });
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly create: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as CreateDeliveryZoneBody;
    sendData(
      response,
      await this.useCases.create({
        organizationId: caller.organizationId,
        actorUserId: caller.actorUserId,
        body,
      }),
      { status: HTTP_CREATED },
    );
  };

  readonly get: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as DeliveryZoneIdParams;
    sendData(
      response,
      await this.useCases.get({
        organizationId: caller.organizationId,
        actorUserId: caller.actorUserId,
        deliveryZoneId: params.deliveryZoneId,
      }),
    );
  };

  readonly update: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as DeliveryZoneIdParams;
    const body = response.locals["validated"].body as UpdateDeliveryZoneBody;
    sendData(
      response,
      await this.useCases.update({
        organizationId: caller.organizationId,
        actorUserId: caller.actorUserId,
        deliveryZoneId: params.deliveryZoneId,
        body: updateRequestOf(body),
      }),
    );
  };
}

/**
 * Delivery-zone routes of `/orgs/{organizationId}/sales`. Every route is organization-wide:
 * a location-restricted member is refused before any read.
 */
export function buildDeliveryZoneTenantRouter(input: DeliveryZoneRouterDependencies): Router {
  const { controller, permission, idempotency } = input;
  const manage = [permission(PERMISSION_KEY.SALES_DELIVERY_ZONE_MANAGE), requireAllLocations()];
  const router = Router({ mergeParams: true });
  router.get(
    "/sales/delivery-zones",
    ...manage,
    validate({ query: deliveryZoneListQuerySchema }),
    controller.list,
  );
  router.post(
    "/sales/delivery-zones",
    ...manage,
    validate({ body: createDeliveryZoneRequestSchema }),
    idempotency,
    controller.create,
  );
  router.get(
    "/sales/delivery-zones/:deliveryZoneId",
    ...manage,
    validate({ params: deliveryZoneIdParamsSchema }),
    controller.get,
  );
  router.patch(
    "/sales/delivery-zones/:deliveryZoneId",
    ...manage,
    validate({ params: deliveryZoneIdParamsSchema, body: updateDeliveryZoneRequestSchema }),
    idempotency,
    controller.update,
  );
  return router;
}
