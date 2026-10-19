import { PERMISSION_KEY } from "@banijjik/contracts";
import {
  approvalGrantRequestSchema,
  approvalPinSetRequestSchema,
  approversQuerySchema,
} from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, validate } from "../../../../kernel/http/index.js";
import { ERROR_CODE } from "@banijjik/contracts";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import { APPROVAL_RATE_LIMIT } from "../domain/approval-limits.js";
import type { ApprovalsController } from "./approvals.controller.js";

function limitApprovalsByIp(limiter: RateLimiter): RequestHandler {
  return rateLimit({ limiter, ...APPROVAL_RATE_LIMIT.PER_IP });
}

function limitApprovalsByOrg(limiter: RateLimiter): RequestHandler {
  return rateLimit({
    limiter,
    ...APPROVAL_RATE_LIMIT.PER_ORG,
    keyOf: () => {
      const organizationId = getRequestContext().organizationId;
      if (organizationId === undefined) {
        throw new AppError({
          code: ERROR_CODE.INTERNAL,
          messageKey: "errors.missing_tenant_context",
        });
      }
      return organizationId;
    },
  });
}

/**
 * Approval PIN and grant endpoints (14 §4, ADR-121), mounted behind the tenant pipeline.
 */
export function buildApprovalsRouter(
  controller: ApprovalsController,
  permission: PermissionMiddlewareFactory,
  rateLimiter: RateLimiter,
): Router {
  const router = Router({ mergeParams: true });
  router.put(
    "/me/approval-pin",
    permission(PERMISSION_KEY.IAM_APPROVAL_GRANT),
    validate({ body: approvalPinSetRequestSchema }),
    controller.setPin,
  );
  router.delete(
    "/me/approval-pin",
    permission(PERMISSION_KEY.IAM_APPROVAL_GRANT),
    controller.removePin,
  );
  router.get("/approvers", validate({ query: approversQuerySchema }), controller.listApprovers);
  router.post(
    "/approvals",
    limitApprovalsByIp(rateLimiter),
    limitApprovalsByOrg(rateLimiter),
    validate({ body: approvalGrantRequestSchema }),
    controller.grant,
  );
  return router;
}
