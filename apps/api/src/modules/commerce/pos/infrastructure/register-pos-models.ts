import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  POS_DEVICE_COLLECTION_NAME,
  POS_DEVICE_MODEL_NAME,
  POS_SESSION_COLLECTION_NAME,
  POS_SESSION_MODEL_NAME,
  posDeviceSchema,
  posSessionSchema,
} from "./pos.schema.js";

/** Devices and sessions belong to one location, so a caller sees only the locations they reach (ADR-005). */
export function registerPosModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: POS_DEVICE_MODEL_NAME,
    collectionName: POS_DEVICE_COLLECTION_NAME,
    schema: posDeviceSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: POS_SESSION_MODEL_NAME,
    collectionName: POS_SESSION_COLLECTION_NAME,
    schema: posSessionSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}
