import type { EnrollmentDependencies } from "../modules/commerce/enrollment/index.js";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { Router } from "express";
import {
  buildEnrollmentDependencies,
  buildEnrollmentRouter,
} from "../modules/commerce/enrollment/index.js";
import { buildRequestQuoter, type BookingRouterInput } from "./booking-tenant-router.js";

export function buildEnrollmentRuntime(input: BookingRouterInput): EnrollmentDependencies {
  const quoter = buildRequestQuoter(input);
  return buildEnrollmentDependencies({
    ...input,
    fee: async (organizationId, body) => {
      const quote = await quoter.quote({
        organizationId: asId<OrganizationId>(organizationId),
        locationId: body.locationId,
        offeringId: body.offeringId,
        variantId: body.variantId,
      });
      return quote.totals.grandTotal;
    },
  });
}
export function buildEnrollmentTenantRouter(input: BookingRouterInput): Router {
  return buildEnrollmentRouter({
    dependencies: buildEnrollmentRuntime(input),
    permission: input.permission,
    idempotency: input.idempotency,
  });
}
