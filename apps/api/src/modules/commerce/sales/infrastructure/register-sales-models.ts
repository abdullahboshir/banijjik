import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  ORDER_COLLECTION_NAME,
  ORDER_COUNTER_COLLECTION_NAME,
  ORDER_COUNTER_MODEL_NAME,
  ORDER_MODEL_NAME,
  orderCounterSchema,
  orderSchema,
} from "./sales.schema.js";

export function registerSalesModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: ORDER_MODEL_NAME,
    collectionName: ORDER_COLLECTION_NAME,
    schema: orderSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: ORDER_COUNTER_MODEL_NAME,
    collectionName: ORDER_COUNTER_COLLECTION_NAME,
    schema: orderCounterSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
