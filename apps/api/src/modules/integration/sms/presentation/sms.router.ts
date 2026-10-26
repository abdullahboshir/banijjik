import { PERMISSION_KEY, PLATFORM_PERMISSION_KEY } from "@banijjik/contracts";
import { smsGatewaySchema, smsLogQuerySchema, smsTestSchema } from "@banijjik/validation/sms";
import { Router } from "express";
import {
  requireAllLocations,
  type PermissionMiddlewareFactory,
} from "../../../../kernel/access/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { SmsController } from "./sms.controller.js";

export function smsTenantRouter(
  controller: SmsController,
  permission: PermissionMiddlewareFactory,
): Router {
  const router = Router();
  router.get(
    "/sms/gateway",
    permission(PERMISSION_KEY.SMS_GATEWAY_READ),
    requireAllLocations(),
    controller.read,
  );
  router.put(
    "/sms/gateway",
    permission(PERMISSION_KEY.SMS_CREDENTIAL_UPDATE),
    requireAllLocations(),
    validate({ body: smsGatewaySchema }),
    controller.save,
  );
  router.post(
    "/sms/gateway/test",
    permission(PERMISSION_KEY.SMS_CREDENTIAL_UPDATE),
    requireAllLocations(),
    validate({ body: smsTestSchema }),
    controller.test,
  );
  router.get(
    "/sms/logs",
    permission(PERMISSION_KEY.SMS_LOG_READ),
    requireAllLocations(),
    validate({ query: smsLogQuerySchema }),
    controller.list,
  );
  return router;
}

export function smsPlatformRouter(
  controller: SmsController,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  const router = Router();
  router.get("/sms-gateway", permission(PLATFORM_PERMISSION_KEY.SMS_READ), controller.read);
  router.put(
    "/sms-gateway",
    permission(PLATFORM_PERMISSION_KEY.SMS_WRITE),
    validate({ body: smsGatewaySchema }),
    controller.save,
  );
  router.post(
    "/sms-gateway/test",
    permission(PLATFORM_PERMISSION_KEY.SMS_WRITE),
    validate({ body: smsTestSchema }),
    controller.test,
  );
  return router;
}
