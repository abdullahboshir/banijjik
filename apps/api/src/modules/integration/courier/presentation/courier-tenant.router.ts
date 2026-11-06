import { PERMISSION_KEY } from "@banijjik/contracts";
import { asId, type CourierSettlementId } from "@banijjik/ids";
import {
  consignmentListQuerySchema,
  courierSettlementIdParamsSchema,
  createConsignmentRequestSchema,
  recordCourierSettlementRequestSchema,
  reverseCourierSettlementRequestSchema,
  type ConsignmentListQuery,
  type CourierSettlementIdParams,
  type CreateConsignmentBody,
  type RecordCourierSettlementBody,
  type ReverseCourierSettlementBody,
} from "@banijjik/validation/courier";
import { Router, type RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type { CourierRouterDependencies } from "../application/courier-dependencies.js";
import { CreateConsignmentUseCase } from "../application/use-cases/create-consignment.use-case.js";
import { ListConsignmentsUseCase } from "../application/use-cases/list-consignments.use-case.js";
import { RecordCourierSettlementUseCase } from "../application/use-cases/record-settlement.use-case.js";
import { ReverseCourierSettlementUseCase } from "../application/use-cases/reverse-settlement.use-case.js";
import { toConsignmentResponse, toCourierSettlementResponse } from "./courier-views.js";

export class CourierHttpController {
  constructor(
    private readonly useCases: {
      readonly createConsignment: CreateConsignmentUseCase;
      readonly listConsignments: ListConsignmentsUseCase;
      readonly recordSettlement: RecordCourierSettlementUseCase;
      readonly reverseSettlement: ReverseCourierSettlementUseCase;
    },
  ) {}

  readonly createConsignment: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as CreateConsignmentBody;
    const consignment = await this.useCases.createConsignment.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      actorUserId: caller.actorUserId,
      body,
    });
    sendData(response, toConsignmentResponse(consignment));
  };

  readonly listConsignments: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const query = response.locals["validated"].query as ConsignmentListQuery;
    const page = await this.useCases.listConsignments.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      orderId: query.orderId,
      courierKey: query.courierKey,
      locationId: query.locationId,
      page: query.page,
      limit: query.limit,
    });
    sendData(response, page.items.map(toConsignmentResponse), {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly recordSettlement: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as RecordCourierSettlementBody;
    const settlement = await this.useCases.recordSettlement.execute({
      organizationId: caller.organizationId,
      actorUserId: caller.actorUserId,
      body,
    });
    sendData(response, toCourierSettlementResponse(settlement));
  };

  readonly reverseSettlement: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as CourierSettlementIdParams;
    const body = response.locals["validated"].body as ReverseCourierSettlementBody;
    const settlement = await this.useCases.reverseSettlement.execute({
      organizationId: caller.organizationId,
      actorUserId: caller.actorUserId,
      courierSettlementId: asId<CourierSettlementId>(params.courierSettlementId),
      body,
    });
    sendData(response, toCourierSettlementResponse(settlement));
  };
}

export function buildCourierTenantRouter(input: CourierRouterDependencies): Router {
  const { permission, idempotency } = input;
  const controller = new CourierHttpController({
    createConsignment: new CreateConsignmentUseCase(input),
    listConsignments: new ListConsignmentsUseCase(input),
    recordSettlement: new RecordCourierSettlementUseCase(input),
    reverseSettlement: new ReverseCourierSettlementUseCase(input),
  });

  const router = Router({ mergeParams: true });

  router.post(
    "/courier/consignments",
    permission(PERMISSION_KEY.COURIER_CONSIGNMENT_CREATE),
    validate({ body: createConsignmentRequestSchema }),
    idempotency,
    controller.createConsignment,
  );

  router.get(
    "/courier/consignments",
    permission(PERMISSION_KEY.COURIER_CONSIGNMENT_READ),
    validate({ query: consignmentListQuerySchema }),
    controller.listConsignments,
  );

  router.post(
    "/courier/settlements",
    permission(PERMISSION_KEY.COURIER_SETTLEMENT_RECORD),
    validate({ body: recordCourierSettlementRequestSchema }),
    idempotency,
    controller.recordSettlement,
  );

  router.post(
    "/courier/settlements/:courierSettlementId/reverse",
    permission(PERMISSION_KEY.COURIER_SETTLEMENT_REVERSE),
    validate({
      params: courierSettlementIdParamsSchema,
      body: reverseCourierSettlementRequestSchema,
    }),
    idempotency,
    controller.reverseSettlement,
  );

  return router;
}
