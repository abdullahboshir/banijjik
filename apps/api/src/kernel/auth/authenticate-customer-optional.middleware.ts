import { STOREFRONT_ACCESS_COOKIE_NAME } from "@banijjik/contracts/contact";
import type { RequestHandler } from "express";
import { getRequestContext, runWithRequestContext } from "../context/index.js";
import { readCookie } from "../http/index.js";
import type { CustomerAccountStatusReader } from "./customer-account-gate.js";
import type { CustomerTokenVerifier } from "./customer-access-token.js";

export interface AuthenticateCustomerOptionalOptions {
  readonly verifier: CustomerTokenVerifier;
  readonly accounts: CustomerAccountStatusReader;
}

/**
 * When a valid storefront cookie is present, signs the customer in for the request (MEMBERS tier).
 * Missing or invalid cookies leave the request anonymous (PUBLIC tier). Never throws for absence.
 */
export function authenticateCustomerOptional(
  options: AuthenticateCustomerOptionalOptions,
): RequestHandler {
  return async (request, _response, next) => {
    const token = readCookie(request, STOREFRONT_ACCESS_COOKIE_NAME);
    if (token === undefined) {
      next();
      return;
    }
    const claims = await options.verifier.verify(token);
    const context = getRequestContext();
    if (claims === undefined || claims.organizationId !== context.organizationId) {
      next();
      return;
    }
    if (!(await options.accounts.isActive(claims.customerAccountId))) {
      next();
      return;
    }
    runWithRequestContext({ ...context, customerAccountId: claims.customerAccountId }, () =>
      next(),
    );
  };
}
