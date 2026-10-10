import { loginRequestSchema, userRegisterRequestSchema } from "@banijjik/validation";
import { Router, type RequestHandler } from "express";
import { validate } from "../../../../kernel/http/index.js";
import { rateLimit, type RateLimiter } from "../../../../kernel/rate-limit/index.js";
import { AUTH_RATE_LIMIT, type AuthRateLimit } from "../domain/auth-limits.js";
import type { AuthController } from "./auth.controller.js";
import { translateDomainErrors } from "./translate-domain-errors.js";

function limitByIp(limiter: RateLimiter, limit: AuthRateLimit): RequestHandler {
  return rateLimit({ limiter, ...limit });
}

/**
 * Auth routes, mounted at /auth. `logout-all` needs a session: routes/v1.ts puts authenticate()
 * in front of that one path, because authentication is mounted only there.
 */
export function buildAuthRouter(controller: AuthController, rateLimiter: RateLimiter): Router {
  const router = Router();
  router.post(
    "/register",
    limitByIp(rateLimiter, AUTH_RATE_LIMIT.REGISTER_PER_IP),
    validate({ body: userRegisterRequestSchema }),
    translateDomainErrors(controller.register),
  );
  router.post(
    "/login",
    limitByIp(rateLimiter, AUTH_RATE_LIMIT.LOGIN_PER_IP),
    validate({ body: loginRequestSchema }),
    translateDomainErrors(controller.login),
  );
  router.post(
    "/refresh",
    limitByIp(rateLimiter, AUTH_RATE_LIMIT.REFRESH_PER_IP),
    translateDomainErrors(controller.refresh),
  );
  router.post("/logout", translateDomainErrors(controller.logout));
  router.post("/logout-all", translateDomainErrors(controller.logoutAll));
  return router;
}
