import { PERMISSION_KEY } from "@banijjik/contracts";
import { offeringIdParamsSchema, versionedTransitionRequestSchema } from "@banijjik/validation";
import {
  inventoryItemCreateRequestSchema,
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  inventoryItemUpdateRequestSchema,
  inventoryLevelsRebuildRequestSchema,
  offeringAvailabilityQuerySchema,
  stockAdjustmentRequestSchema,
  stockLevelsQuerySchema,
  stockMovementsQuerySchema,
  stockReceiptRequestSchema,
  stockTransferRequestSchema,
} from "@banijjik/validation/inventory";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { requireAllLocations } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { InventoryItemController } from "./inventory-item.controller.js";
import type { StockController } from "./stock.controller.js";

export interface InventoryRouterDependencies {
  readonly items: InventoryItemController;
  readonly stock: StockController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly rebuildRateLimit: RequestHandler;
}

function mountItems(router: Router, input: InventoryRouterDependencies): void {
  const { items, permission } = input;
  router.get(
    "/inventory-items",
    permission(PERMISSION_KEY.INVENTORY_STOCK_READ),
    validate({ query: inventoryItemListQuerySchema }),
    items.list,
  );
  router.get(
    "/inventory-items/:inventoryItemId",
    permission(PERMISSION_KEY.INVENTORY_STOCK_READ),
    validate({ params: inventoryItemIdParamsSchema }),
    items.get,
  );
  router.post(
    "/inventory-items",
    permission(PERMISSION_KEY.INVENTORY_ITEM_UPDATE),
    requireAllLocations(),
    validate({ body: inventoryItemCreateRequestSchema }),
    items.create,
  );
  router.patch(
    "/inventory-items/:inventoryItemId",
    permission(PERMISSION_KEY.INVENTORY_ITEM_UPDATE),
    requireAllLocations(),
    validate({ params: inventoryItemIdParamsSchema, body: inventoryItemUpdateRequestSchema }),
    items.update,
  );
  router.post(
    "/inventory-items/:inventoryItemId/archive",
    permission(PERMISSION_KEY.INVENTORY_ITEM_UPDATE),
    requireAllLocations(),
    validate({ params: inventoryItemIdParamsSchema, body: versionedTransitionRequestSchema }),
    items.archive,
  );
}

function mountStock(router: Router, input: InventoryRouterDependencies): void {
  const { stock, permission, idempotency, rebuildRateLimit } = input;
  router.post(
    "/stock/receipts",
    permission(PERMISSION_KEY.INVENTORY_ADJUSTMENT_CREATE),
    validate({ body: stockReceiptRequestSchema }),
    idempotency,
    stock.receive,
  );
  router.post(
    "/stock/adjustments",
    permission(PERMISSION_KEY.INVENTORY_ADJUSTMENT_CREATE),
    validate({ body: stockAdjustmentRequestSchema }),
    idempotency,
    stock.adjust,
  );
  router.post(
    "/stock/transfers",
    permission(PERMISSION_KEY.INVENTORY_TRANSFER_CREATE),
    validate({ body: stockTransferRequestSchema }),
    idempotency,
    stock.transfer,
  );
  router.get(
    "/stock/levels",
    permission(PERMISSION_KEY.INVENTORY_STOCK_READ),
    validate({ query: stockLevelsQuerySchema }),
    stock.levels,
  );
  router.get(
    "/stock/movements",
    permission(PERMISSION_KEY.INVENTORY_MOVEMENT_READ),
    validate({ query: stockMovementsQuerySchema }),
    stock.movements,
  );
  router.get(
    "/offerings/:offeringId/availability",
    permission(PERMISSION_KEY.INVENTORY_STOCK_READ),
    validate({ params: offeringIdParamsSchema, query: offeringAvailabilityQuerySchema }),
    stock.availability,
  );
  router.post(
    "/inventory/levels/rebuild",
    permission(PERMISSION_KEY.INVENTORY_ITEM_UPDATE),
    requireAllLocations(),
    rebuildRateLimit,
    validate({ body: inventoryLevelsRebuildRequestSchema }),
    stock.rebuild,
  );
}

export function buildInventoryTenantRouter(input: InventoryRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountItems(router, input);
  mountStock(router, input);
  return router;
}
