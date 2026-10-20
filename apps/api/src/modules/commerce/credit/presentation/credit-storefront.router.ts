import { Router, type RequestHandler } from "express";
import { requireCurrentCustomerAccountId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type { UnlockListingUseCase } from "../application/index.js";
import type { GetMyCreditsUseCase } from "../application/index.js";
import type { GetMyUnlocksUseCase } from "../application/index.js";
import type { ListCreditPacksUseCase } from "../application/index.js";

const UNLOCK_IP_BUCKET = "credit.unlock.ip";
const UNLOCK_ACCOUNT_BUCKET = "credit.unlock.account";

export interface CreditStorefrontRouterDependencies {
  readonly unlockListing: UnlockListingUseCase;
  readonly getMyCredits: GetMyCreditsUseCase;
  readonly getMyUnlocks: GetMyUnlocksUseCase;
  readonly listPacks: ListCreditPacksUseCase;
  readonly limiter: RateLimiter;
  readonly authenticateCustomer: RequestHandler;
  readonly authenticateCustomerOptional: RequestHandler;
}

function mountUnlockRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.post(
    "/listings/:listingNumber/unlock",
    rateLimit({
      limiter: input.limiter,
      bucket: UNLOCK_IP_BUCKET,
      limit: 20,
      windowSeconds: 60,
    }),
    input.authenticateCustomer,
    rateLimit({
      limiter: input.limiter,
      bucket: UNLOCK_ACCOUNT_BUCKET,
      limit: 20,
      windowSeconds: 60,
      keyOf: () => requireCurrentCustomerAccountId(),
    }),
    async (request, response) => {
      sendData(
        response,
        await input.unlockListing.execute({
          listingNumber: request.params.listingNumber,
          customerAccountId: requireCurrentCustomerAccountId(),
          idempotencyKey: request.body.idempotencyKey,
        }),
      );
    },
  );
}

function mountMyCreditsRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.get("/my/credits", input.authenticateCustomer, async (_request, response) => {
    sendData(
      response,
      await input.getMyCredits.execute(requireCurrentCustomerAccountId(), { limit: 20, offset: 0 }),
    );
  });
}

function mountMyUnlocksRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.get("/my/unlocks", input.authenticateCustomer, async (_request, response) => {
    sendData(
      response,
      await input.getMyUnlocks.execute(requireCurrentCustomerAccountId(), { limit: 20, offset: 0 }),
    );
  });
}

function mountCreditPacksRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.get("/credit-packs", input.authenticateCustomerOptional, async (_request, response) => {
    sendData(response, await input.listPacks.execute());
  });
}

export function buildCreditStorefrontRouter(input: CreditStorefrontRouterDependencies): Router {
  const router = Router({ mergeParams: true });
  mountUnlockRoute(router, input);
  mountMyCreditsRoute(router, input);
  mountMyUnlocksRoute(router, input);
  mountCreditPacksRoute(router, input);
  return router;
}
