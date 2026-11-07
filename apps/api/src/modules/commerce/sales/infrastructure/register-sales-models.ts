import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  DELIVERY_ATTEMPT_COLLECTION_NAME,
  DELIVERY_ATTEMPT_MODEL_NAME,
  deliveryAttemptSchema,
} from "./delivery-attempt.schema.js";
import {
  DELIVERY_LOSS_CLOSURE_COLLECTION_NAME,
  DELIVERY_LOSS_CLOSURE_MODEL_NAME,
  DELIVERY_LOSS_RECOVERY_COLLECTION_NAME,
  DELIVERY_LOSS_RECOVERY_MODEL_NAME,
  deliveryLossClosureSchema,
  deliveryLossRecoverySchema,
} from "./delivery-loss.schema.js";
import {
  DELIVERY_ZONE_COLLECTION_NAME,
  DELIVERY_ZONE_MODEL_NAME,
  deliveryZoneSchema,
} from "./delivery-zone.schema.js";
import {
  SALES_RETURN_COLLECTION_NAME,
  SALES_RETURN_MODEL_NAME,
  salesReturnSchema,
} from "./sales-return.schema.js";
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
    modelName: SALES_RETURN_MODEL_NAME,
    collectionName: SALES_RETURN_COLLECTION_NAME,
    schema: salesReturnSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: ORDER_COUNTER_MODEL_NAME,
    collectionName: ORDER_COUNTER_COLLECTION_NAME,
    schema: orderCounterSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: DELIVERY_ZONE_MODEL_NAME,
    collectionName: DELIVERY_ZONE_COLLECTION_NAME,
    schema: deliveryZoneSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: DELIVERY_ATTEMPT_MODEL_NAME,
    collectionName: DELIVERY_ATTEMPT_COLLECTION_NAME,
    schema: deliveryAttemptSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: DELIVERY_LOSS_CLOSURE_MODEL_NAME,
    collectionName: DELIVERY_LOSS_CLOSURE_COLLECTION_NAME,
    schema: deliveryLossClosureSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: DELIVERY_LOSS_RECOVERY_MODEL_NAME,
    collectionName: DELIVERY_LOSS_RECOVERY_COLLECTION_NAME,
    schema: deliveryLossRecoverySchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}
