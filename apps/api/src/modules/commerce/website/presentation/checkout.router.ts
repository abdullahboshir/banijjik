import {
  SF_GUEST_COOKIE_NAME,
  STOREFRONT_CHECKOUT_PER_WINDOW,
  STOREFRONT_CHECKOUT_RATE_LIMIT_BUCKET,
  STOREFRONT_CHECKOUT_WINDOW_SECONDS,
  parseGuestCookie,
  type StorefrontRequestListQuery,
} from "@banijjik/contracts/website";
import {
  checkoutIdParamsSchema,
  publicQuoteRequestSchema,
  storefrontRequestListQuerySchema,
  storefrontRequestParamsSchema,
  submitCheckoutRequestSchema,
} from "@banijjik/validation/website";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { readCookie, sendData, unauthenticated, validate } from "../../../../kernel/http/index.js";
import { createStorefrontIdempotencyMiddleware } from "../../../../kernel/idempotency/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ClaimCheckoutUseCase } from "../application/claim-checkout.js";
import type { ReadOwnRequestsUseCase } from "../application/read-own-requests.js";
import type {
  CheckoutAccessRepositoryPort,
  QuoteCheckoutUseCase,
  SubmitCheckoutUseCase,
} from "../index.js";
import type { ResolveGuestSessionUseCase } from "../application/use-cases/resolve-guest-session.use-case.js";
import {
  buildAuthorizeReplay,
  createStorefrontPrincipalMiddleware,
  resolveNamespace,
  resolveOrgId,
  type CheckoutRequestWithPrincipal,
} from "./storefront-principal.middleware.js";

export {
  createStorefrontPrincipalMiddleware,
  getRequestPrincipal,
  buildAuthorizeReplay,
  resolveNamespace,
  resolveOrgId,
  type CheckoutRequestWithPrincipal,
} from "./storefront-principal.middleware.js";

export interface CheckoutRouterDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly quoteCheckout: QuoteCheckoutUseCase;
  readonly submitCheckout: SubmitCheckoutUseCase;
  readonly readOwnRequests?: ReadOwnRequestsUseCase;
  readonly claimCheckout?: ClaimCheckoutUseCase;
  readonly resolveGuestSession: ResolveGuestSessionUseCase;
  readonly resolveCustomerContactId?: (
    organizationId: string,
    customerAccountId: string,
  ) => Promise<string | undefined>;
  readonly access: CheckoutAccessRepositoryPort;
  readonly limiter: RateLimiter;
  readonly clock: Clock;
  readonly isProduction?: boolean;
}

function registerQuoteRoute(
  router: Router,
  deps: CheckoutRouterDependencies,
  resolvePrincipal: RequestHandler,
): void {
  router.post(
    "/quotes",
    deps.requireWebsiteModule,
    resolvePrincipal,
    validate({ body: publicQuoteRequestSchema }),
    async (request: CheckoutRequestWithPrincipal, response: Response) => {
      const organizationId = resolveOrgId();
      const principal = request.checkoutPrincipal;
      if (!principal) throw unauthenticated();

      const result = await deps.quoteCheckout.execute({
        organizationId,
        principal,
        request: request.body,
      });

      sendData(response, result, { status: 201 });
    },
  );
}

function registerCheckoutRoute(
  router: Router,
  deps: CheckoutRouterDependencies,
  resolvePrincipal: RequestHandler,
): void {
  router.post(
    "/checkout",
    deps.requireWebsiteModule,
    resolvePrincipal,
    rateLimit({
      limiter: deps.limiter,
      bucket: STOREFRONT_CHECKOUT_RATE_LIMIT_BUCKET,
      limit: STOREFRONT_CHECKOUT_PER_WINDOW,
      windowSeconds: STOREFRONT_CHECKOUT_WINDOW_SECONDS,
      keyOf: (req) => {
        const principal = (req as CheckoutRequestWithPrincipal).checkoutPrincipal;
        const id =
          principal?.type === "CUSTOMER"
            ? principal.customerAccountId
            : (principal?.guestSessionId ?? "anon");
        return `${resolveOrgId()}:${id}`;
      },
    }),
    createStorefrontIdempotencyMiddleware({
      clock: deps.clock,
      resolveNamespace,
      authorizeReplay: buildAuthorizeReplay(deps.access),
    }),
    validate({ body: submitCheckoutRequestSchema }),
    async (request: CheckoutRequestWithPrincipal, response: Response) => {
      const organizationId = resolveOrgId();
      const principal = request.checkoutPrincipal;
      if (!principal) throw unauthenticated();

      const idempotencyKey = String(request.headers["idempotency-key"]);
      const result = await deps.submitCheckout.execute({
        organizationId,
        principal,
        idempotencyKey,
        body: request.body,
      });

      sendData(response, result, { status: 201 });
    },
  );
}

function registerCheckoutDetailRoute(
  router: Router,
  deps: CheckoutRouterDependencies,
  resolvePrincipal: RequestHandler,
): void {
  if (!deps.readOwnRequests) return;
  const reader = deps.readOwnRequests;

  router.get(
    "/checkouts/:checkoutId",
    deps.requireWebsiteModule,
    resolvePrincipal,
    validate({ params: checkoutIdParamsSchema }),
    async (req: CheckoutRequestWithPrincipal, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      const organizationId = resolveOrgId();
      const principal = req.checkoutPrincipal;
      if (!principal) throw unauthenticated();

      const checkoutId = String(req.params.checkoutId);
      const result = await reader.getCheckoutDetail({ organizationId, principal, checkoutId });
      sendData(res, result);
    },
  );
}

function registerRequestListAndDetailRoutes(
  router: Router,
  deps: CheckoutRouterDependencies,
  resolvePrincipal: RequestHandler,
): void {
  if (!deps.readOwnRequests) return;
  const reader = deps.readOwnRequests;

  router.get(
    "/me/requests",
    deps.requireWebsiteModule,
    resolvePrincipal,
    validate({ query: storefrontRequestListQuerySchema }),
    async (req: CheckoutRequestWithPrincipal, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      const organizationId = resolveOrgId();
      const principal = req.checkoutPrincipal;
      if (!principal) throw unauthenticated();

      const result = await reader.listRequests({
        organizationId,
        principal,
        query: req.query as StorefrontRequestListQuery,
      });
      sendData(res, result);
    },
  );

  router.get(
    "/me/requests/:requestType/:requestId",
    deps.requireWebsiteModule,
    resolvePrincipal,
    validate({ params: storefrontRequestParamsSchema }),
    async (req: CheckoutRequestWithPrincipal, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      const organizationId = resolveOrgId();
      const principal = req.checkoutPrincipal;
      if (!principal) throw unauthenticated();

      const requestType = req.params.requestType as "ORDER" | "BOOKING" | "ENROLLMENT";
      const requestId = String(req.params.requestId);
      const result = await reader.getRequestDetail({
        organizationId,
        principal,
        requestType,
        requestId,
      });
      sendData(res, result);
    },
  );
}

function registerClaimRoutes(router: Router, deps: CheckoutRouterDependencies): void {
  if (!deps.claimCheckout) return;
  const claimer = deps.claimCheckout;

  router.post(
    "/checkouts/:checkoutId/claim",
    deps.requireWebsiteModule,
    validate({ params: checkoutIdParamsSchema }),
    async (req: Request, res: Response) => {
      res.setHeader("Cache-Control", "private, no-store");
      const organizationId = resolveOrgId();
      const ctx = getRequestContext();
      const customerAccountId = ctx.customerAccountId;
      if (!customerAccountId) throw unauthenticated();

      const rawCookie = readCookie(req, SF_GUEST_COOKIE_NAME);
      const parsed = parseGuestCookie(rawCookie);
      if (!parsed) throw unauthenticated();

      const checkoutId = String(req.params.checkoutId);
      const result = await claimer.execute({
        organizationId,
        checkoutId,
        guestSessionId: parsed.guestSessionId,
        rawSecret: parsed.rawSecret,
        customerAccountId,
      });
      sendData(res, result);
    },
  );
}

function registerTrackingAndClaimRoutes(
  router: Router,
  deps: CheckoutRouterDependencies,
  resolvePrincipal: RequestHandler,
): void {
  registerCheckoutDetailRoute(router, deps, resolvePrincipal);
  registerRequestListAndDetailRoutes(router, deps, resolvePrincipal);
  registerClaimRoutes(router, deps);
}

export function buildCheckoutRouter(dependencies: CheckoutRouterDependencies): Router {
  const router = Router();
  const resolvePrincipal = createStorefrontPrincipalMiddleware(
    dependencies.resolveGuestSession,
    dependencies.resolveCustomerContactId,
  );

  registerQuoteRoute(router, dependencies, resolvePrincipal);
  registerCheckoutRoute(router, dependencies, resolvePrincipal);
  registerTrackingAndClaimRoutes(router, dependencies, resolvePrincipal);

  return router;
}
