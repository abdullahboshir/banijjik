import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import { Router } from "express";
import type { AppConfig } from "../config/index.js";
import { authenticate, createJoseAccessTokenVerifier } from "../kernel/auth/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildIamRouters, registerIamModels } from "../modules/core/iam/index.js";

export interface V1Dependencies {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
}

/** Every module registers its models here, before the databases connect (see main.ts). */
export function registerModuleModels(): void {
  registerIamModels();
}

/**
 * The only place that mounts module routers and global middleware (AGENTS.md).
 * Tenant context, entitlement and permission middleware join in cards 1.3 and 1.4.
 */
export function buildV1Router(dependencies: V1Dependencies): Router {
  const { config, clock } = dependencies;
  const router = Router();
  const verifier = createJoseAccessTokenVerifier({ secret: config.auth.accessTokenSecret, clock });
  const requireAdminUser = authenticate({ audience: TOKEN_AUDIENCE.ADMIN, verifier });
  const { authRouter, meRouter } = buildIamRouters(dependencies);

  // logout-all lives in the auth router but needs a session; the rest of /auth is public.
  router.use("/auth/logout-all", requireAdminUser);
  router.use("/auth", authRouter);
  router.use("/me", requireAdminUser, meRouter);
  return router;
}
