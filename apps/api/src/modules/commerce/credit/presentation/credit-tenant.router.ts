import { PERMISSION_KEY } from "@banijjik/contracts";
import { Router } from "express";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import { asId, type CustomerAccountId } from "@banijjik/ids";
import type { AdjustCreditsUseCase } from "../use-cases/adjust-credits.use-case.js";
import type { GetMyCreditsUseCase } from "../use-cases/get-my-credits.use-case.js";

export interface CreditTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly adjustCredits: AdjustCreditsUseCase;
  readonly getAccount: GetMyCreditsUseCase;
}

export function buildCreditTenantRouter(input: CreditTenantRouterDependencies): Router {
  const router = Router({ mergeParams: true });

  const read = input.permission(PERMISSION_KEY.CREDIT_ACCOUNT_READ);
  router.get("/credit/accounts/:customerAccountId", read, async (request, response) => {
    sendData(
      response,
      await input.getAccount.execute(asId<CustomerAccountId>(request.params.customerAccountId), {
        limit: 20,
        offset: 0,
      }),
    );
  });

  const adjust = input.permission(PERMISSION_KEY.CREDIT_ACCOUNT_ADJUST);
  router.post("/credit/accounts/:customerAccountId/adjust", adjust, async (request, response) => {
    sendData(
      response,
      await input.adjustCredits.execute({
        customerAccountId: asId<CustomerAccountId>(request.params.customerAccountId),
        credits: request.body.credits,
        reason: request.body.reason,
        approvalToken: request.body.approvalToken,
        actorUserId: requireCurrentUserId(),
      }),
    );
  });

  return router;
}
