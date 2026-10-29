import { ERROR_CODE, IDEMPOTENCY_SCOPE_KIND } from "@banijjik/contracts";
import { getRequestContext } from "../context/index.js";
import { AppError, unauthenticated } from "../http/index.js";
import type { IdempotencyNamespace } from "./idempotency.middleware.js";

const SCOPE_SEPARATOR = ":";

export type StorefrontIdempotencyPrincipal =
  | { readonly type: "CUSTOMER"; readonly customerAccountId: string }
  | { readonly type: "GUEST"; readonly guestSessionId: string };

function requireScopePart(value: string): string {
  if (value === "" || value.includes(SCOPE_SEPARATOR)) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
  }
  return value;
}

/** Technical STOREFRONT key: organization plus customer or guest. Callers never send this string. */
export function storefrontIdempotencyNamespace(input: {
  readonly organizationId: string;
  readonly principal: StorefrontIdempotencyPrincipal;
}): IdempotencyNamespace {
  const principalId =
    input.principal.type === "CUSTOMER"
      ? input.principal.customerAccountId
      : input.principal.guestSessionId;
  return {
    scopeKind: IDEMPOTENCY_SCOPE_KIND.STOREFRONT,
    scopeId: [
      input.principal.type,
      requireScopePart(input.organizationId),
      requireScopePart(principalId),
    ].join(SCOPE_SEPARATOR),
  };
}

export function storefrontNamespaceFromContext(): IdempotencyNamespace {
  const { organizationId, customerAccountId, guestSessionId } = getRequestContext();
  if (organizationId === undefined) throw unauthenticated();
  if (customerAccountId !== undefined && guestSessionId !== undefined) {
    throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" });
  }
  if (customerAccountId !== undefined) {
    return storefrontIdempotencyNamespace({
      organizationId,
      principal: { type: "CUSTOMER", customerAccountId },
    });
  }
  if (guestSessionId === undefined) throw unauthenticated();
  return storefrontIdempotencyNamespace({
    organizationId,
    principal: { type: "GUEST", guestSessionId },
  });
}
