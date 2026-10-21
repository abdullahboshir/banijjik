import { IDEMPOTENCY_KEY_HEADER } from "@banijjik/contracts";
import {
  creditEntriesQuerySchema,
  unlockListingParamsSchema,
  unlocksQuerySchema,
} from "@banijjik/validation/credit";
import { idempotencyKeySchema } from "@banijjik/validation";
import { Router, type Request, type RequestHandler } from "express";
import { requireCurrentCustomerAccountId } from "../../../../kernel/auth/index.js";
import { sendData, validate, validationFailed } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type {
  GetMyCreditsUseCase,
  GetMyUnlocksUseCase,
  ListActiveCreditPacksUseCase,
  UnlockListingUseCase,
} from "../application/index.js";

const UNLOCK_IP_BUCKET = "credit.unlock.ip";
const UNLOCK_ACCOUNT_BUCKET = "credit.unlock.account";
const UNLOCK_IP_LIMIT = 20;
const UNLOCK_ACCOUNT_LIMIT = 20;
const ONE_MINUTE_SECONDS = 60;

export interface CreditStorefrontRouterDependencies {
  readonly unlockListing: UnlockListingUseCase;
  readonly getMyCredits: GetMyCreditsUseCase;
  readonly getMyUnlocks: GetMyUnlocksUseCase;
  readonly listPacks: ListActiveCreditPacksUseCase;
  readonly limiter: RateLimiter;
  readonly authenticateCustomer: RequestHandler;
  readonly authenticateCustomerOptional: RequestHandler;
}

interface PageQuery {
  readonly page: number;
  readonly limit: number;
}

function offsetOf(query: PageQuery): { limit: number; offset: number } {
  return { limit: query.limit, offset: (query.page - 1) * query.limit };
}

/** The header is required and must be a UUID; the natural (customer, listing) key is the guard. */
function requiredIdempotencyKey(request: Request): string {
  const header = request.get(IDEMPOTENCY_KEY_HEADER)?.trim();
  if (header === undefined || header === "") {
    throw validationFailed([
      { path: IDEMPOTENCY_KEY_HEADER, messageKey: "validation.idempotency_key_required" },
    ]);
  }
  const parsed = idempotencyKeySchema.safeParse(header);
  if (!parsed.success) {
    throw validationFailed([
      { path: IDEMPOTENCY_KEY_HEADER, messageKey: "validation.idempotency_key_invalid" },
    ]);
  }
  return parsed.data;
}

function mountUnlockRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.post(
    "/listings/:listingNumber/unlock",
    rateLimit({
      limiter: input.limiter,
      bucket: UNLOCK_IP_BUCKET,
      limit: UNLOCK_IP_LIMIT,
      windowSeconds: ONE_MINUTE_SECONDS,
    }),
    input.authenticateCustomer,
    rateLimit({
      limiter: input.limiter,
      bucket: UNLOCK_ACCOUNT_BUCKET,
      limit: UNLOCK_ACCOUNT_LIMIT,
      windowSeconds: ONE_MINUTE_SECONDS,
      keyOf: () => requireCurrentCustomerAccountId(),
    }),
    validate({ params: unlockListingParamsSchema }),
    async (request, response) => {
      requiredIdempotencyKey(request);
      const { listingNumber } = response.locals["validated"].params as { listingNumber: string };
      sendData(
        response,
        await input.unlockListing.execute({
          listingNumber,
          customerAccountId: requireCurrentCustomerAccountId(),
        }),
      );
    },
  );
}

function mountMyCreditsRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.get(
    "/my/credits",
    input.authenticateCustomer,
    validate({ query: creditEntriesQuerySchema }),
    async (_request, response) => {
      sendData(
        response,
        await input.getMyCredits.execute(
          requireCurrentCustomerAccountId(),
          offsetOf(response.locals["validated"].query as PageQuery),
        ),
      );
    },
  );
}

function mountMyUnlocksRoute(router: Router, input: CreditStorefrontRouterDependencies): void {
  router.get(
    "/my/unlocks",
    input.authenticateCustomer,
    validate({ query: unlocksQuerySchema }),
    async (_request, response) => {
      sendData(
        response,
        await input.getMyUnlocks.execute(
          requireCurrentCustomerAccountId(),
          offsetOf(response.locals["validated"].query as PageQuery),
        ),
      );
    },
  );
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
