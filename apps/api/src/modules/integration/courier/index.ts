import type { Router } from "express";
import type { CourierRouterDependencies } from "./application/courier-dependencies.js";
import { GetCourierInfoUseCase } from "./application/use-cases/get-courier-info.use-case.js";
import { ManifestCourierInfoSource } from "./infrastructure/manifest-courier-info.source.js";
import { courierManifest } from "./module.manifest.js";
import {
  toCourierInfoResponse,
  type CourierInfoResponse,
} from "./presentation/courier-info.transformer.js";
import { buildCourierTenantRouter } from "./presentation/courier-tenant.router.js";
import type {
  CourierSettlementPostingSource,
  CourierSettlementPostingSnapshot,
} from "../../commerce/accounting/index.js";
import {
  COURIER_SETTLEMENT_MODEL_NAME,
  type CourierSettlementDocument,
} from "./infrastructure/courier.schema.js";
import { models } from "../../../kernel/db/index.js";
import { asId, type CourierSettlementId } from "@banijjik/ids";

export { courierManifest } from "./module.manifest.js";
export { registerCourierModels } from "./infrastructure/register-courier-models.js";
export {
  MongoConsignmentRepository,
  MongoCourierSettlementRepository,
} from "./infrastructure/mongo-courier.repository.js";
export { Consignment } from "./domain/consignment.entity.js";
export { CourierSettlement } from "./domain/courier-settlement.entity.js";
export type {
  ConsignmentFilters,
  ConsignmentPage,
  ConsignmentRepository,
  CourierSettlementRepository,
} from "./domain/courier-repository.js";
export { CreateConsignmentUseCase } from "./application/use-cases/create-consignment.use-case.js";
export { ListConsignmentsUseCase } from "./application/use-cases/list-consignments.use-case.js";
export { RecordCourierSettlementUseCase } from "./application/use-cases/record-settlement.use-case.js";
export { ReverseCourierSettlementUseCase } from "./application/use-cases/reverse-settlement.use-case.js";
export type {
  CourierApprovalPort,
  CourierDependencies,
  CourierOrderPort,
  CourierPaymentPort,
  CourierRouterDependencies,
} from "./application/courier-dependencies.js";
export { buildCourierTenantRouter };

export function buildCourierInfo(): CourierInfoResponse {
  const source = new ManifestCourierInfoSource(courierManifest);
  const useCase = new GetCourierInfoUseCase(source);
  return toCourierInfoResponse(useCase.execute());
}

export function buildCourierRouter(dependencies: CourierRouterDependencies): Router {
  return buildCourierTenantRouter(dependencies);
}

export function buildCourierSettlementPostingSourceAdapter(): CourierSettlementPostingSource {
  return {
    async readCourierSettlement(
      courierSettlementId: string,
    ): Promise<CourierSettlementPostingSnapshot | undefined> {
      const doc = await models({})
        .get<CourierSettlementDocument>(COURIER_SETTLEMENT_MODEL_NAME)
        .findOne(
          { courierSettlementId: asId<CourierSettlementId>(courierSettlementId) },
          { _id: 0 },
        )
        .lean<CourierSettlementDocument>();
      if (!doc) return undefined;
      return {
        courierSettlementId: doc.courierSettlementId,
        organizationId: doc.organizationId,
        businessDate: doc.businessDate,
        locationId: null,
        paymentIds: doc.paymentIds,
        grossAmount: doc.grossAmount,
        courierCharges: doc.courierCharges,
        netReceived: doc.netReceived,
        receivedVia: doc.receivedVia as CourierSettlementPostingSnapshot["receivedVia"],
        reversesCourierSettlementId: doc.reversesCourierSettlementId,
      };
    },
  };
}
