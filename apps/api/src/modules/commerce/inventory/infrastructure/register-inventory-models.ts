import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { registerModel } from "../../../../kernel/db/index.js";
import {
  INVENTORY_ITEM_COLLECTION_NAME,
  INVENTORY_ITEM_MODEL_NAME,
  INVENTORY_LEVEL_COLLECTION_NAME,
  INVENTORY_LEVEL_MODEL_NAME,
  STOCK_MOVEMENT_COLLECTION_NAME,
  STOCK_MOVEMENT_MODEL_NAME,
  STOCK_RESERVATION_COLLECTION_NAME,
  STOCK_RESERVATION_MODEL_NAME,
  inventoryItemSchema,
  inventoryLevelSchema,
  stockMovementSchema,
  stockReservationSchema,
} from "./inventory.schemas.js";

/** Inventory items are organization-wide; levels, movements and reservations are location-scoped. */
export function registerInventoryModels(): void {
  const tenant = { database: DATABASE_KIND.TENANT } as const;
  registerModel({
    ...tenant,
    modelName: INVENTORY_ITEM_MODEL_NAME,
    collectionName: INVENTORY_ITEM_COLLECTION_NAME,
    schema: inventoryItemSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION,
  });
  registerModel({
    ...tenant,
    modelName: STOCK_MOVEMENT_MODEL_NAME,
    collectionName: STOCK_MOVEMENT_COLLECTION_NAME,
    schema: stockMovementSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: INVENTORY_LEVEL_MODEL_NAME,
    collectionName: INVENTORY_LEVEL_COLLECTION_NAME,
    schema: inventoryLevelSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
  registerModel({
    ...tenant,
    modelName: STOCK_RESERVATION_MODEL_NAME,
    collectionName: STOCK_RESERVATION_COLLECTION_NAME,
    schema: stockReservationSchema,
    tenancy: MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
  });
}
