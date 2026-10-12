import { loginRequestSchema } from "@banijjik/validation";
import { Router } from "express";
import { validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import { AUTH_RATE_LIMIT } from "../domain/auth-limits.js";
import type { PlatformAuthController } from "./platform-auth.controller.js";

/**
 * `/platform/auth`, public like `/auth`. Its rate limits count in their own buckets, so a flood on
 * the platform login never locks business users out, and the reverse.
 */
export function buildPlatformAuthRouter(
  controller: PlatformAuthController,
  limiter: RateLimiter,
): Router {
  const router = Router();
  router.post(
    "/login",
    rateLimit({ limiter, ...AUTH_RATE_LIMIT.PLATFORM_LOGIN_PER_IP }),
    validate({ body: loginRequestSchema }),
    controller.login,
  );
  router.post(
    "/refresh",
    rateLimit({ limiter, ...AUTH_RATE_LIMIT.PLATFORM_REFRESH_PER_IP }),
    controller.refresh,
  );
  router.post("/logout", controller.logout);
  // Needs a session: routes/platform.ts authenticates this one path before the rest of /platform/auth.
  router.post("/logout-all", controller.logoutAll);
  return router;
}
