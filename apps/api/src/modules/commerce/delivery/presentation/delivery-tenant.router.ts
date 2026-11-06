import { PERMISSION_KEY } from "@banijjik/contracts";
import { asId, type RiderCashHandoverId } from "@banijjik/ids";
import {
  createDeliveryAssignmentRequestSchema,
  deliveryAssignmentListQuerySchema,
  recordRiderCashHandoverRequestSchema,
  reverseRiderCashHandoverRequestSchema,
  riderCashHandoverIdParamsSchema,
  type CreateDeliveryAssignmentBody,
  type DeliveryAssignmentListQuery,
  type RecordRiderCashHandoverBody,
  type ReverseRiderCashHandoverBody,
  type RiderCashHandoverIdParams,
} from "@banijjik/validation/delivery";
import { Router, type RequestHandler } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData, validate } from "../../../../kernel/http/index.js";
import type { DeliveryRouterDependencies } from "../application/delivery-dependencies.js";
import { CreateDeliveryAssignmentUseCase } from "../application/use-cases/create-assignment.use-case.js";
import { ListDeliveryAssignmentsUseCase } from "../application/use-cases/list-assignments.use-case.js";
import { RecordRiderCashHandoverUseCase } from "../application/use-cases/record-handover.use-case.js";
import { ReverseRiderCashHandoverUseCase } from "../application/use-cases/reverse-handover.use-case.js";
import {
  toDeliveryAssignmentResponse,
  toRiderCashHandoverResponse,
} from "./delivery-views.js";

export class DeliveryHttpController {
  constructor(
    private readonly useCases: {
      readonly createAssignment: CreateDeliveryAssignmentUseCase;
      readonly listAssignments: ListDeliveryAssignmentsUseCase;
      readonly recordHandover: RecordRiderCashHandoverUseCase;
      readonly reverseHandover: ReverseRiderCashHandoverUseCase;
    },
  ) {}

  readonly createAssignment: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as CreateDeliveryAssignmentBody;
    const assignment = await this.useCases.createAssignment.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      actorUserId: caller.actorUserId,
      body,
    });
    sendData(response, toDeliveryAssignmentResponse(assignment));
  };

  readonly listAssignments: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const query = response.locals["validated"].query as DeliveryAssignmentListQuery;
    const page = await this.useCases.listAssignments.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      query,
    });
    sendData(response, {
      items: page.items.map(toDeliveryAssignmentResponse),
      total: page.total,
      hasNext: page.hasNext,
    });
  };

  readonly recordHandover: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const body = response.locals["validated"].body as RecordRiderCashHandoverBody;
    const handover = await this.useCases.recordHandover.execute({
      organizationId: caller.organizationId,
      allowedLocationIds: caller.allowedLocationIds,
      actorUserId: caller.actorUserId,
      body,
    });
    sendData(response, toRiderCashHandoverResponse(handover));
  };

  readonly reverseHandover: RequestHandler = async (_request, response) => {
    const caller = readTenantCaller();
    const params = response.locals["validated"].params as RiderCashHandoverIdParams;
    const body = response.locals["validated"].body as ReverseRiderCashHandoverBody;
    const handover = await this.useCases.reverseHandover.execute({
      organizationId: caller.organizationId,
      riderCashHandoverId: asId<RiderCashHandoverId>(params.riderCashHandoverId),
      actorUserId: caller.actorUserId,
      body,
    });
    sendData(response, toRiderCashHandoverResponse(handover));
  };
}

export function buildDeliveryTenantRouter(input: DeliveryRouterDependencies): Router {
  const { permission, idempotency } = input;
  const controller = new DeliveryHttpController({
    createAssignment: new CreateDeliveryAssignmentUseCase(input),
    listAssignments: new ListDeliveryAssignmentsUseCase(input),
    recordHandover: new RecordRiderCashHandoverUseCase(input),
    reverseHandover: new ReverseRiderCashHandoverUseCase(input),
  });

  const router = Router({ mergeParams: true });

  router.post(
    "/delivery/assignments",
    permission(PERMISSION_KEY.DELIVERY_ASSIGNMENT_CREATE),
    validate({ body: createDeliveryAssignmentRequestSchema }),
    idempotency,
    controller.createAssignment,
  );

  router.get(
    "/delivery/assignments",
    permission(PERMISSION_KEY.DELIVERY_ASSIGNMENT_READ),
    validate({ query: deliveryAssignmentListQuerySchema }),
    controller.listAssignments,
  );

  router.post(
    "/delivery/handovers",
    permission(PERMISSION_KEY.DELIVERY_HANDOVER_RECORD),
    validate({ body: recordRiderCashHandoverRequestSchema }),
    idempotency,
    controller.recordHandover,
  );

  router.post(
    "/delivery/handovers/:riderCashHandoverId/reverse",
    permission(PERMISSION_KEY.DELIVERY_HANDOVER_REVERSE),
    validate({
      params: riderCashHandoverIdParamsSchema,
      body: reverseRiderCashHandoverRequestSchema,
    }),
    idempotency,
    controller.reverseHandover,
  );

  return router;
}
