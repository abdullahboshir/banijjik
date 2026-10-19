import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import type { AppConfig } from "../../../config/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { Router } from "express";
import { LoginUseCase } from "./application/use-cases/login.use-case.js";
import { LogoutAllUseCase } from "./application/use-cases/logout-all.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case.js";
import { PLATFORM_LOGIN_LIMITS } from "./domain/auth-limits.js";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher.js";
import { MongoPlatformOperatorRepository } from "./infrastructure/mongo-platform-operator.repository.js";
import { MongoRefreshSessionRepository } from "./infrastructure/mongo-refresh-session.repository.js";
import { MongoUserRepository } from "./infrastructure/mongo-user.repository.js";
import { AuthCookies, PLATFORM_COOKIES } from "./presentation/auth-cookies.js";
import { PlatformAuthController } from "./presentation/platform-auth.controller.js";
import { buildPlatformAuthRouter } from "./presentation/platform-auth.router.js";
import type { SessionIssuer } from "./application/session-issuer.js";

export interface PlatformAuthCompositionInput {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
  readonly sessionIssuer: SessionIssuer;
}

/**
 * `/platform/auth`: login, refresh and logout of platform operators, on the PLATFORM audience with
 * their own cookies and rate-limit buckets (ADR-048).
 */
export function buildIamPlatformAuthRouter(input: PlatformAuthCompositionInput): Router {
  const { config, clock, rateLimiter, sessionIssuer } = input;
  const users = new MongoUserRepository();
  const sessions = new MongoRefreshSessionRepository();
  const operators = new MongoPlatformOperatorRepository();
  const audience = TOKEN_AUDIENCE.PLATFORM;
  const controller = new PlatformAuthController({
    login: new LoginUseCase({
      users,
      sessions,
      hasher: new Argon2PasswordHasher(),
      sessionIssuer,
      rateLimiter,
      clock,
      audience,
      operators,
      limits: PLATFORM_LOGIN_LIMITS,
    }),
    refreshSession: new RefreshSessionUseCase({
      users,
      sessions,
      sessionIssuer,
      unitOfWork: new MongoUnitOfWork(),
      clock,
      audience,
      operators,
    }),
    logout: new LogoutUseCase({ sessions, clock, audience }),
    logoutAll: new LogoutAllUseCase({ sessions, clock, audience }),
    cookies: new AuthCookies({
      isSecure: config.nodeEnv === "production",
      domain: config.auth.cookieDomain,
      accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
      ...PLATFORM_COOKIES,
    }),
    clock,
  });
  return buildPlatformAuthRouter(controller, rateLimiter);
}
