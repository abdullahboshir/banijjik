import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  DELIVERY_ASSIGNMENT_COLLECTION_NAME,
  DELIVERY_ASSIGNMENT_MODEL_NAME,
  deliveryAssignmentSchema,
  RIDER_CASH_HANDOVER_COLLECTION_NAME,
  RIDER_CASH_HANDOVER_MODEL_NAME,
  riderCashHandoverSchema,
} from "./delivery.schema.js";

let registered = false;

export function registerDeliveryModels(): void {
  if (registered) return;
  registered = true;

  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: DELIVERY_ASSIGNMENT_MODEL_NAME,
    collectionName: DELIVERY_ASSIGNMENT_COLLECTION_NAME,
    schema: deliveryAssignmentSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });

  registerModel({
    ...tenant,
    modelName: RIDER_CASH_HANDOVER_MODEL_NAME,
    collectionName: RIDER_CASH_HANDOVER_COLLECTION_NAME,
    schema: riderCashHandoverSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
