import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  CONSIGNMENT_COLLECTION_NAME,
  CONSIGNMENT_MODEL_NAME,
  consignmentSchema,
  COURIER_SETTLEMENT_COLLECTION_NAME,
  COURIER_SETTLEMENT_MODEL_NAME,
  courierSettlementSchema,
} from "./courier.schema.js";

export function registerCourierModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: CONSIGNMENT_MODEL_NAME,
    collectionName: CONSIGNMENT_COLLECTION_NAME,
    schema: consignmentSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: COURIER_SETTLEMENT_MODEL_NAME,
    collectionName: COURIER_SETTLEMENT_COLLECTION_NAME,
    schema: courierSettlementSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
