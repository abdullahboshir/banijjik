import { PERMISSION_KEY } from "@banijjik/contracts";
import { contactIdParamsSchema, customerAccountBlockRequestSchema } from "@banijjik/validation";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { validate } from "../../../../kernel/http/index.js";
import type { CustomerAccountStaffController } from "./customer-account-staff.controller.js";

/** The staff routes of a contact's website login, mounted behind the tenant pipeline (14-API.md section 5.3). */
export function buildCustomerAccountStaffRouter(input: {
  readonly accounts: CustomerAccountStaffController;
  readonly permission: PermissionMiddlewareFactory;
}): Router {
  const { accounts: controller, permission } = input;
  const params = contactIdParamsSchema;
  const router = Router({ mergeParams: true });
  router.get(
    "/contacts/:contactId/customer-account",
    permission(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_READ),
    validate({ params }),
    controller.get,
  );
  router.post(
    "/contacts/:contactId/customer-account/block",
    permission(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK),
    validate({ params, body: customerAccountBlockRequestSchema }),
    controller.block,
  );
  router.post(
    "/contacts/:contactId/customer-account/unblock",
    permission(PERMISSION_KEY.CONTACT_CUSTOMER_ACCOUNT_BLOCK),
    validate({ params, body: customerAccountBlockRequestSchema }),
    controller.unblock,
  );
  return router;
}
