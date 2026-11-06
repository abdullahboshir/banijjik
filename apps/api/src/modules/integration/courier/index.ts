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
