import { ERROR_CODE } from "@banijjik/contracts";
import {
  SF_GUEST_COOKIE_NAME,
  STOREFRONT_CHECKOUT_PER_WINDOW,
  STOREFRONT_CHECKOUT_RATE_LIMIT_BUCKET,
  STOREFRONT_CHECKOUT_WINDOW_SECONDS,
  parseGuestCookie,
  type CheckoutPrincipal,
} from "@banijjik/contracts/website";
import { Router, type Request, type RequestHandler, type Response } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import {
  AppError,
  readCookie,
  sendData,
  unauthenticated,
  validate,
} from "../../../../kernel/http/index.js";
import {
  createStorefrontIdempotencyMiddleware,
  storefrontIdempotencyNamespace,
  type IdempotencyReplayAuthorization,
} from "../../../../kernel/idempotency/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import {
  publicQuoteRequestSchema,
  submitCheckoutRequestSchema,
} from "@banijjik/validation/website";
import type {
  CheckoutAccessRepositoryPort,
  QuoteCheckoutUseCase,
  SubmitCheckoutUseCase,
} from "../index.js";
import type { ResolveGuestSessionUseCase } from "../application/use-cases/resolve-guest-session.use-case.js";

export interface CheckoutRequestWithPrincipal extends Request {
  checkoutPrincipal?: CheckoutPrincipal;
}

export interface CheckoutRouterDependencies {
  readonly requireWebsiteModule: RequestHandler;
  readonly quoteCheckout: QuoteCheckoutUseCase;
  readonly submitCheckout: SubmitCheckoutUseCase;
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

function resolveOrgId(): string {
  const { organizationId } = getRequestContext();
  if (!organizationId) {
    throw new AppError({
      code: ERROR_CODE.NOT_FOUND,
      messageKey: "errors.storefront_not_available",
    });
  }
  return organizationId;
}

export function createStorefrontPrincipalMiddleware(
  resolveGuestSession: ResolveGuestSessionUseCase,
  resolveCustomerContactId?: (
    organizationId: string,
    customerAccountId: string,
  ) => Promise<string | undefined>,
): RequestHandler {
  return async (req: CheckoutRequestWithPrincipal, _res: Response, next) => {
    const ctx = getRequestContext();
    const organizationId = resolveOrgId();

    if (ctx.customerAccountId) {
      const contactId = resolveCustomerContactId
        ? await resolveCustomerContactId(organizationId, ctx.customerAccountId)
        : undefined;
      if (contactId) {
        req.checkoutPrincipal = {
          type: "CUSTOMER",
          customerAccountId: ctx.customerAccountId,
          contactId,
        };
        return next();
      }
    }

    const rawCookie = readCookie(req, SF_GUEST_COOKIE_NAME);
    const parsed = parseGuestCookie(rawCookie);
    if (!parsed) {
      throw unauthenticated();
    }

    const outcome = await resolveGuestSession.execute({
      organizationId,
      guestSessionId: parsed.guestSessionId,
      rawSecret: parsed.rawSecret,
    });

    if (outcome.kind === "CROSS_ORG") {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }
    if (outcome.kind === "EXPIRED") {
      throw new AppError({
        code: ERROR_CODE.WEBSITE_GUEST_SESSION_EXPIRED,
        messageKey: "errors.website_guest_session_expired",
      });
    }
    if (outcome.kind === "INVALID") {
      throw unauthenticated();
    }

    req.checkoutPrincipal = {
      type: "GUEST",
      guestSessionId: outcome.session.guestSessionId,
    };
    next();
  };
}

function getRequestPrincipal(req?: Request): CheckoutPrincipal {
  const principal = (req as CheckoutRequestWithPrincipal | undefined)?.checkoutPrincipal;
  if (principal) return principal;
  const ctx = getRequestContext();
  if (ctx.customerAccountId) {
    return { type: "CUSTOMER", customerAccountId: ctx.customerAccountId, contactId: "" };
  }
  if (ctx.guestSessionId) {
    return { type: "GUEST", guestSessionId: ctx.guestSessionId };
  }
  throw unauthenticated();
}

function buildAuthorizeReplay(access: CheckoutAccessRepositoryPort) {
  return async (authorization: IdempotencyReplayAuthorization, req?: Request): Promise<void> => {
    const organizationId = resolveOrgId();
    const body = authorization.body as { data?: { checkoutId?: string } } | undefined;
    const checkoutId = body?.data?.checkoutId;
    if (!checkoutId) return;

    const accessRecord = await access.findByCheckoutId(organizationId, checkoutId);
    if (!accessRecord || accessRecord.revokedAt !== null) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }

    const principal = getRequestPrincipal(req);
    const principalId =
      principal.type === "CUSTOMER" ? principal.customerAccountId : principal.guestSessionId;

    if (
      accessRecord.owner.type !== principal.type ||
      accessRecord.owner.identifier !== principalId
    ) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN, messageKey: "errors.forbidden" });
    }
  };
}

function resolveNamespace(req?: Request) {
  const principal = getRequestPrincipal(req);
  const organizationId = resolveOrgId();
  if (principal.type === "CUSTOMER") {
    return storefrontIdempotencyNamespace({
      organizationId,
      principal: { type: "CUSTOMER", customerAccountId: principal.customerAccountId },
    });
  }
  return storefrontIdempotencyNamespace({
    organizationId,
    principal: { type: "GUEST", guestSessionId: principal.guestSessionId },
  });
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

export function buildCheckoutRouter(dependencies: CheckoutRouterDependencies): Router {
  const router = Router();
  const resolvePrincipal = createStorefrontPrincipalMiddleware(
    dependencies.resolveGuestSession,
    dependencies.resolveCustomerContactId,
  );

  registerQuoteRoute(router, dependencies, resolvePrincipal);
  registerCheckoutRoute(router, dependencies, resolvePrincipal);

  return router;
}
