import { ERROR_CODE } from "@banijjik/contracts";
import {
  SF_GUEST_COOKIE_NAME,
  parseGuestCookie,
  type CheckoutPrincipal,
} from "@banijjik/contracts/website";
import type { Request, RequestHandler, Response } from "express";
import { getRequestContext } from "../../../../kernel/context/index.js";
import { AppError, readCookie, unauthenticated } from "../../../../kernel/http/index.js";
import {
  storefrontIdempotencyNamespace,
  type IdempotencyNamespace,
  type IdempotencyReplayAuthorization,
} from "../../../../kernel/idempotency/index.js";
import type { CheckoutAccessRepositoryPort } from "../application/checkout-ports.js";
import type { ResolveGuestSessionUseCase } from "../application/use-cases/resolve-guest-session.use-case.js";

export interface CheckoutRequestWithPrincipal extends Request {
  checkoutPrincipal?: CheckoutPrincipal;
}

export function resolveOrgId(): string {
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

export function getRequestPrincipal(req?: Request): CheckoutPrincipal {
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

export function buildAuthorizeReplay(access: CheckoutAccessRepositoryPort) {
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

export function resolveNamespace(req?: Request): IdempotencyNamespace {
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
