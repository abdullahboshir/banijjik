import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  PROMOTION_COLLECTION_NAME,
  PROMOTION_MODEL_NAME,
  TAX_CLASS_COLLECTION_NAME,
  TAX_CLASS_MODEL_NAME,
  promotionSchema,
  taxClassSchema,
} from "./pricing.schemas.js";

export function registerPricingModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: TAX_CLASS_MODEL_NAME,
    collectionName: TAX_CLASS_COLLECTION_NAME,
    schema: taxClassSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: PROMOTION_MODEL_NAME,
    collectionName: PROMOTION_COLLECTION_NAME,
    schema: promotionSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
}
