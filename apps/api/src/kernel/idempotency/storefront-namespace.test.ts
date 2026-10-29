import { IDEMPOTENCY_SCOPE_KIND } from "@banijjik/contracts";
import { newId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "../context/index.js";
import { AppError } from "../http/index.js";
import {
  storefrontIdempotencyNamespace,
  storefrontNamespaceFromContext,
} from "./storefront-namespace.js";

describe("storefront idempotency namespace", () => {
  it("builds a STOREFRONT key from organization and customer, never from a client string", () => {
    const organizationId = newId();
    const customerAccountId = newId();

    const namespace = storefrontIdempotencyNamespace({
      organizationId,
      principal: { type: "CUSTOMER", customerAccountId },
    });

    expect(namespace.scopeKind).toBe(IDEMPOTENCY_SCOPE_KIND.STOREFRONT);
    expect(namespace.scopeId).toBe(`CUSTOMER:${organizationId}:${customerAccountId}`);
  });

  it("keeps guest, customer, and other organizations in separate key spaces", () => {
    const organizationId = newId();
    const otherOrganizationId = newId();
    const guestSessionId = newId();
    const customerAccountId = newId();

    const guest = storefrontIdempotencyNamespace({
      organizationId,
      principal: { type: "GUEST", guestSessionId },
    });
    const customer = storefrontIdempotencyNamespace({
      organizationId,
      principal: { type: "CUSTOMER", customerAccountId },
    });
    const otherOrgGuest = storefrontIdempotencyNamespace({
      organizationId: otherOrganizationId,
      principal: { type: "GUEST", guestSessionId },
    });

    expect(new Set([guest.scopeId, customer.scopeId, otherOrgGuest.scopeId]).size).toBe(3);
  });

  it("refuses a part that would break the technical key", () => {
    expect(() =>
      storefrontIdempotencyNamespace({
        organizationId: "org:forged",
        principal: { type: "GUEST", guestSessionId: newId() },
      }),
    ).toThrow(AppError);
  });

  it("reads the principal from request context, not from a body field", () => {
    const organizationId = newId();
    const guestSessionId = newId();

    const namespace = runWithRequestContext(
      { requestId: newId(), organizationId, guestSessionId },
      () => storefrontNamespaceFromContext(),
    );

    expect(namespace).toEqual(
      storefrontIdempotencyNamespace({
        organizationId,
        principal: { type: "GUEST", guestSessionId },
      }),
    );
  });

  it("refuses a request that carries both a customer and a guest principal", () => {
    expect(() =>
      runWithRequestContext(
        {
          requestId: newId(),
          organizationId: newId(),
          customerAccountId: newId(),
          guestSessionId: newId(),
        },
        () => storefrontNamespaceFromContext(),
      ),
    ).toThrow(/INTERNAL/);
  });

  it("answers unauthenticated when the storefront has no principal", () => {
    expect(() =>
      runWithRequestContext({ requestId: newId(), organizationId: newId() }, () =>
        storefrontNamespaceFromContext(),
      ),
    ).toThrow(/UNAUTHENTICATED/);
  });
});
