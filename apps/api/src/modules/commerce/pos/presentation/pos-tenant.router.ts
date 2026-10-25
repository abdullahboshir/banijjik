import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  posCatalogSnapshotQuerySchema,
  posCollectionRequestSchema,
  posDeviceCreateRequestSchema,
  posDeviceIdParamsSchema,
  posDeviceListQuerySchema,
  posDevicePairRequestSchema,
  posDeviceRevokeRequestSchema,
  posHeldCartCreateRequestSchema,
  posHeldCartDeleteQuerySchema,
  posHeldCartIdParamsSchema,
  posReturnRequestSchema,
  posSaleRequestSchema,
  posSessionCloseRequestSchema,
  posSessionIdParamsSchema,
  posSessionListQuerySchema,
  posSessionOpenRequestSchema,
} from "@banijjik/validation/pos";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { PosController } from "./pos.controller.js";

export interface PosRouterDependencies {
  readonly controller: PosController;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  /** Finds the device behind the cookie; mounted on every route that acts at a till. */
  readonly requireDevice: RequestHandler;
}

function mountDeviceRoutes(input: PosRouterDependencies, router: Router): void {
  const { controller, permission } = input;
  router.get(
    "/pos/devices",
    permission(PERMISSION_KEY.POS_DEVICE_MANAGE),
    validate({ query: posDeviceListQuerySchema }),
    controller.listDevices,
  );
  router.post(
    "/pos/devices",
    permission(PERMISSION_KEY.POS_DEVICE_MANAGE),
    // No Idempotency-Key: it moves no money, and a stored answer would keep the one-time code.
    validate({ body: posDeviceCreateRequestSchema }),
    controller.createDevice,
  );
  // Registered before the `:posDeviceId` routes, so "pair" is never read as an id.
  router.post(
    "/pos/devices/pair",
    permission(PERMISSION_KEY.POS_SESSION_OPEN),
    validate({ body: posDevicePairRequestSchema }),
    controller.pairDevice,
  );
  router.post(
    "/pos/devices/:posDeviceId/revoke",
    permission(PERMISSION_KEY.POS_DEVICE_MANAGE),
    validate({ params: posDeviceIdParamsSchema, body: posDeviceRevokeRequestSchema }),
    controller.revokeDevice,
  );
}

function mountSessionRoutes(input: PosRouterDependencies, router: Router): void {
  const { controller, permission, idempotency, requireDevice } = input;
  router.get(
    "/pos/sessions/current",
    permission(PERMISSION_KEY.POS_SESSION_OPEN),
    requireDevice,
    controller.getCurrentSession,
  );
  router.get(
    "/pos/sessions",
    permission(PERMISSION_KEY.POS_REPORT_READ),
    validate({ query: posSessionListQuerySchema }),
    controller.listSessions,
  );
  router.post(
    "/pos/sessions",
    permission(PERMISSION_KEY.POS_SESSION_OPEN),
    requireDevice,
    validate({ body: posSessionOpenRequestSchema }),
    idempotency,
    controller.openSession,
  );
  // Closing needs the session, not the device: a revoked till's open register can still be counted.
  router.post(
    "/pos/sessions/:posSessionId/close",
    permission(PERMISSION_KEY.POS_REGISTER_CLOSE),
    validate({ params: posSessionIdParamsSchema, body: posSessionCloseRequestSchema }),
    idempotency,
    controller.closeSession,
  );
  router.get(
    "/pos/sessions/:posSessionId/z-report",
    permission(PERMISSION_KEY.POS_REGISTER_CLOSE),
    validate({ params: posSessionIdParamsSchema }),
    controller.getZReport,
  );
}

function mountHeldCartRoutes(input: PosRouterDependencies, router: Router): void {
  const { controller, permission, requireDevice } = input;
  router.get(
    "/pos/held-carts",
    permission(PERMISSION_KEY.POS_SALE_CREATE),
    requireDevice,
    controller.listHeldCarts,
  );
  router.post(
    "/pos/held-carts",
    permission(PERMISSION_KEY.POS_SALE_CREATE),
    requireDevice,
    validate({ body: posHeldCartCreateRequestSchema }),
    controller.createHeldCart,
  );
  router.delete(
    "/pos/held-carts/:posHeldCartId",
    permission(PERMISSION_KEY.POS_SALE_CREATE),
    requireDevice,
    validate({ params: posHeldCartIdParamsSchema, query: posHeldCartDeleteQuerySchema }),
    controller.deleteHeldCart,
  );
}

/**
 * The money-moving POST routes carry `Idempotency-Key` (ADR-014). The device check follows the
 * permission check, so the device lookup obeys the locations the permission grants.
 */
export function buildPosTenantRouter(input: PosRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountDeviceRoutes(input, router);
  mountSessionRoutes(input, router);
  mountHeldCartRoutes(input, router);
  router.post(
    "/pos/sales",
    input.permission(PERMISSION_KEY.POS_SALE_CREATE),
    input.requireDevice,
    validate({ body: posSaleRequestSchema }),
    input.idempotency,
    input.controller.createSale,
  );
  router.post(
    "/pos/collections",
    input.permission(PERMISSION_KEY.POS_SALE_CREATE),
    input.requireDevice,
    validate({ body: posCollectionRequestSchema }),
    input.idempotency,
    input.controller.collectDue,
  );
  router.post(
    "/pos/returns",
    input.permission(PERMISSION_KEY.POS_SALE_CREATE),
    input.permission(PERMISSION_KEY.SALES_RETURN_CREATE),
    input.requireDevice,
    validate({ body: posReturnRequestSchema }),
    input.idempotency,
    input.controller.createReturn,
  );
  router.get(
    "/pos/catalog-snapshot",
    input.permission(PERMISSION_KEY.POS_SALE_CREATE),
    input.requireDevice,
    validate({ query: posCatalogSnapshotQuerySchema }),
    input.controller.catalogSnapshot,
  );
  return router;
}
