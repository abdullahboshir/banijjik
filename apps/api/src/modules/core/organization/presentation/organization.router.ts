import { organizationCreateRequestSchema } from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import { validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import { ORGANIZATION_CREATE_PER_USER } from "../domain/organization-limits.js";
import type { OrganizationController } from "./organization.controller.js";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";

/** Routes of the signed-in user's organizations, mounted at /me/orgs behind authenticate() by routes/v1.ts. */
export function buildOrganizationRouter(
  controller: OrganizationController,
  rateLimiter: RateLimiter,
  idempotency: RequestHandler,
): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post(
    "/",
    rateLimit({
      limiter: rateLimiter,
      ...ORGANIZATION_CREATE_PER_USER,
      keyOf: () => requireCurrentUserId(),
    }),
    validate({ body: organizationCreateRequestSchema }),
    idempotency,
    controller.create,
  );
  return router;
}
