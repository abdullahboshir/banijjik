import { STOREFRONT_ACCESS_COOKIE_NAME } from "@banijjik/contracts/contact";
import type { RequestHandler } from "express";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import { readCookie, unauthenticated } from "../http/index.js";
import type { CustomerAccountStatusReader } from "./customer-account-gate.js";
import type { CustomerTokenVerifier } from "./customer-access-token.js";

export interface AuthenticateCustomerOptions {
  readonly verifier: CustomerTokenVerifier;
  /** Usually wrapped in `cacheAccountStatus`. */
  readonly accounts: CustomerAccountStatusReader;
}

/**
 * Signs a customer in for one request: a valid storefront token, issued by the business of the
 * path (the request context's organization), for an account that is still ACTIVE. Admin tokens fail
 * the audience check, and a token of business A fails the organization check at business B (ADR-119).
 */
export function authenticateCustomer(options: AuthenticateCustomerOptions): RequestHandler {
  return async (request, _response, next) => {
    const token = readCookie(request, STOREFRONT_ACCESS_COOKIE_NAME);
    if (token === undefined) throw unauthenticated();
    const claims = await options.verifier.verify(token);
    const context = getRequestContext();
    if (claims === undefined || claims.organizationId !== context.organizationId) {
      throw unauthenticated();
    }
    if (!(await options.accounts.isActive(claims.customerAccountId))) throw unauthenticated();
    runWithRequestContext({ ...context, customerAccountId: claims.customerAccountId }, () =>
      next(),
    );
  };
}
