import { invitationTokenParamsSchema } from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import {
  INVITATION_ACCEPT_PER_USER,
  INVITATION_PREVIEW_PER_IP,
} from "../domain/organization-limits.js";
import type { InvitationController } from "./invitation.controller.js";

/**
 * The two user-level routes behind an invitation link, mounted at /invitations by routes/v1.ts
 * (14-API.md section 4). The preview is public and limited per IP; accepting needs a signed-in
 * user, limited per user. The token is a path segment, so access logs mask it (kernel logger).
 */
export function buildInvitationLinkRouter(
  controller: InvitationController,
  rateLimiter: RateLimiter,
  requireUser: RequestHandler,
): Router {
  const router = Router();
  const params = { params: invitationTokenParamsSchema };
  router.get(
    "/:token",
    rateLimit({ limiter: rateLimiter, ...INVITATION_PREVIEW_PER_IP }),
    validate(params),
    controller.preview,
  );
  router.post(
    "/:token/accept",
    requireUser,
    rateLimit({
      limiter: rateLimiter,
      ...INVITATION_ACCEPT_PER_USER,
      keyOf: () => requireCurrentUserId(),
    }),
    validate(params),
    controller.accept,
  );
  return router;
}
