import { type Router } from "express";
import type { AppConfig } from "../../../config/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { SessionIssuer } from "./application/session-issuer.js";
import { EnsurePlatformAdminUseCase } from "./application/use-cases/ensure-platform-admin.use-case.js";
import { GetMeUseCase } from "./application/use-cases/get-me.use-case.js";
import { LoginUseCase } from "./application/use-cases/login.use-case.js";
import { LogoutAllUseCase } from "./application/use-cases/logout-all.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case.js";
import { RegisterUserUseCase } from "./application/use-cases/register-user.use-case.js";
import { UpdateMeUseCase } from "./application/use-cases/update-me.use-case.js";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher.js";
import { JwtTokenIssuer } from "./infrastructure/jwt-token-issuer.js";
import { MongoPlatformOperatorRepository } from "./infrastructure/mongo-platform-operator.repository.js";
import { MongoRefreshSessionRepository } from "./infrastructure/mongo-refresh-session.repository.js";
import { MongoUnitOfWork } from "./infrastructure/mongo-unit-of-work.js";
import { MongoUserRepository } from "./infrastructure/mongo-user.repository.js";
import { AuthController } from "./presentation/auth.controller.js";
import { AuthCookies } from "./presentation/auth-cookies.js";
import { buildAuthRouter } from "./presentation/auth.router.js";
import { MeController } from "./presentation/me.controller.js";
import { buildMeRouter } from "./presentation/me.router.js";

export { registerIamModels } from "./infrastructure/register-iam-models.js";
export { iamManifest } from "./module.manifest.js";

export interface IamDependencies {
  readonly config: AppConfig;
  readonly clock: Clock;
  readonly rateLimiter: RateLimiter;
}

export interface IamRouters {
  /** Mounted at /auth. Everything but `logout-all` is public. */
  readonly authRouter: Router;
  /** Mounted at /me, behind authenticate(). */
  readonly meRouter: Router;
}

/** Composition root: repositories, adapters and use cases are wired here and nowhere else. */
export function buildIamRouters(dependencies: IamDependencies): IamRouters {
  const { config, clock, rateLimiter } = dependencies;
  const users = new MongoUserRepository();
  const sessions = new MongoRefreshSessionRepository();
  const hasher = new Argon2PasswordHasher();
  const unitOfWork = new MongoUnitOfWork();
  const sessionIssuer = new SessionIssuer({
    tokenIssuer: new JwtTokenIssuer({
      secret: config.auth.accessTokenSecret,
      ttlSeconds: config.auth.accessTokenTtlSeconds,
      clock,
    }),
    clock,
    policy: {
      refreshTokenTtlDays: config.auth.refreshTokenTtlDays,
      familyMaxDays: config.auth.sessionFamilyMaxDays,
      ipHashSecret: config.auth.accessTokenSecret,
    },
  });
  const authController = new AuthController({
    registerUser: new RegisterUserUseCase({
      users,
      sessions,
      hasher,
      sessionIssuer,
      unitOfWork,
      clock,
    }),
    login: new LoginUseCase({ users, sessions, hasher, sessionIssuer, rateLimiter, clock }),
    refreshSession: new RefreshSessionUseCase({
      users,
      sessions,
      sessionIssuer,
      unitOfWork,
      clock,
    }),
    logout: new LogoutUseCase({ sessions, clock }),
    logoutAll: new LogoutAllUseCase({ sessions, clock }),
    cookies: new AuthCookies({
      isSecure: config.nodeEnv === "production",
      domain: config.auth.cookieDomain,
      accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
    }),
    clock,
  });
  const meController = new MeController({
    getMe: new GetMeUseCase({ users }),
    updateMe: new UpdateMeUseCase({ users }),
  });
  return {
    authRouter: buildAuthRouter(authController, rateLimiter),
    meRouter: buildMeRouter(meController),
  };
}

/** The seed use case for the platform admin. Seeds call this instead of reaching into the module. */
export function buildEnsurePlatformAdminUseCase(clock: Clock): EnsurePlatformAdminUseCase {
  return new EnsurePlatformAdminUseCase({
    users: new MongoUserRepository(),
    operators: new MongoPlatformOperatorRepository(),
    hasher: new Argon2PasswordHasher(),
    unitOfWork: new MongoUnitOfWork(),
    clock,
  });
}

export type { EnsurePlatformAdminUseCase } from "./application/use-cases/ensure-platform-admin.use-case.js";
