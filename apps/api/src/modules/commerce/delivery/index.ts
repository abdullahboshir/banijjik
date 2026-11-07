export { deliveryManifest } from "./module.manifest.js";
export { registerDeliveryModels } from "./infrastructure/register-delivery-models.js";
export {
  DELIVERY_ASSIGNMENT_MODEL_NAME,
  DELIVERY_ASSIGNMENT_COLLECTION_NAME,
  RIDER_CASH_HANDOVER_MODEL_NAME,
  RIDER_CASH_HANDOVER_COLLECTION_NAME,
} from "./infrastructure/delivery.schema.js";
export {
  MongoDeliveryAssignmentRepository,
  MongoRiderCashHandoverRepository,
} from "./infrastructure/mongo-delivery.repository.js";
export {
  DeliveryAssignment,
  type DeliveryAssignmentProps,
} from "./domain/delivery-assignment.entity.js";
export {
  RiderCashHandover,
  type RiderCashHandoverProps,
} from "./domain/rider-cash-handover.entity.js";
export type {
  DeliveryAssignmentFilters,
  DeliveryAssignmentPage,
  DeliveryAssignmentRepository,
  RiderCashHandoverRepository,
} from "./domain/delivery-repository.js";
export {
  CreateDeliveryAssignmentUseCase,
  type CreateAssignmentInput,
} from "./application/use-cases/create-assignment.use-case.js";
export {
  ListDeliveryAssignmentsUseCase,
  type ListAssignmentsInput,
} from "./application/use-cases/list-assignments.use-case.js";
export {
  RecordRiderCashHandoverUseCase,
  type RecordHandoverInput,
} from "./application/use-cases/record-handover.use-case.js";
export {
  ReverseRiderCashHandoverUseCase,
  type ReverseHandoverInput,
} from "./application/use-cases/reverse-handover.use-case.js";
export {
  buildDeliveryTenantRouter,
  DeliveryHttpController,
} from "./presentation/delivery-tenant.router.js";
export {
  toDeliveryAssignmentResponse,
  toRiderCashHandoverResponse,
} from "./presentation/delivery-views.js";

import type {
  RiderHandoverPostingSource,
  RiderHandoverPostingSnapshot,
} from "../accounting/index.js";
import {
  RIDER_CASH_HANDOVER_MODEL_NAME,
  type RiderCashHandoverDocument,
} from "./infrastructure/delivery.schema.js";
import { models } from "../../../kernel/db/index.js";
import { asId, type RiderCashHandoverId } from "@banijjik/ids";

export function buildRiderHandoverPostingSourceAdapter(): RiderHandoverPostingSource {
  return {
    async readRiderHandover(
      riderCashHandoverId: string,
    ): Promise<RiderHandoverPostingSnapshot | undefined> {
      const doc = await models({})
        .get<RiderCashHandoverDocument>(RIDER_CASH_HANDOVER_MODEL_NAME)
        .findOne(
          { riderCashHandoverId: asId<RiderCashHandoverId>(riderCashHandoverId) },
          { _id: 0 },
        )
        .lean<RiderCashHandoverDocument>();
      if (!doc) return undefined;
      return {
        riderCashHandoverId: doc.riderCashHandoverId,
        organizationId: doc.organizationId,
        locationId: doc.locationId,
        businessDate: doc.businessDate,
        paymentIds: doc.paymentIds,
        amount: doc.amount,
        receivedVia: doc.receivedVia as RiderHandoverPostingSnapshot["receivedVia"],
        reversesRiderCashHandoverId: doc.reversesRiderCashHandoverId,
      };
    },
  };
}
export type {
  DeliveryApprovalPort,
  DeliveryDependencies,
  DeliveryEventPublisher,
  DeliveryMemberPort,
  DeliveryOrderPort,
  DeliveryPaymentPort,
  DeliveryRouterDependencies,
  DeliveryUnitOfWork,
} from "./application/delivery-dependencies.js";
