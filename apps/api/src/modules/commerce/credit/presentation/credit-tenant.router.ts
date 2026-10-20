import { PERMISSION_KEY } from "@banijjik/contracts";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import { asId, type CustomerAccountId } from "@banijjik/ids";
import type { AdjustCreditsUseCase, GetMyCreditsUseCase } from "../application/index.js";

export interface CreditTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly adjustCredits: AdjustCreditsUseCase;
  readonly getAccount: GetMyCreditsUseCase;
}

export function buildCreditTenantRouter(input: CreditTenantRouterDependencies): Router {
  const router = Router({ mergeParams: true });

  const read = input.permission(PERMISSION_KEY.CREDIT_ACCOUNT_READ);
  router.get("/credit/accounts/:customerAccountId", read, async (request, response) => {
    const customerAccountIdParam = Array.isArray(request.params.customerAccountId)
      ? request.params.customerAccountId[0]
      : request.params.customerAccountId;
    if (!customerAccountIdParam) {
      throw new Error("customerAccountId is required");
    }
    const customerAccountId = asId<CustomerAccountId>(customerAccountIdParam);
    sendData(
      response,
      await input.getAccount.execute(customerAccountId, {
        limit: 20,
        offset: 0,
      }),
    );
  });

  const adjust = input.permission(PERMISSION_KEY.CREDIT_ACCOUNT_ADJUST);
  router.post("/credit/accounts/:customerAccountId/adjust", adjust, async (request, response) => {
    const customerAccountIdParam = Array.isArray(request.params.customerAccountId)
      ? request.params.customerAccountId[0]
      : request.params.customerAccountId;
    if (!customerAccountIdParam) {
      throw new Error("customerAccountId is required");
    }
    const customerAccountId = asId<CustomerAccountId>(customerAccountIdParam);
    sendData(
      response,
      await input.adjustCredits.execute({
        customerAccountId,
        credits: request.body.credits,
        reason: request.body.reason,
        actorUserId: requireCurrentUserId(),
      }),
    );
  });

  return router;
}
