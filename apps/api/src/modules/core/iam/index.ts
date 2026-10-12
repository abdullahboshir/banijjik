import { TOKEN_AUDIENCE } from "@banijjik/contracts";
import { type Router } from "express";
import type { PlatformOperatorLookup } from "../../../kernel/auth/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import type { AppConfig } from "../../../config/index.js";
import type { PermissionGate, PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { RateLimiter } from "../../../kernel/rate-limit/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { RedisClient } from "../../../kernel/redis/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { type PermissionCatalog } from "./application/permission-catalog.js";
import { IamPermissionGate } from "./application/permission-gate.js";
import { PermissionResolver } from "./application/permission-resolver.js";
import type { MemberAccessReader } from "./application/ports/member-access-reader.js";
import type { PermissionCache } from "./application/ports/permission-cache.js";
import type { RoleRepository } from "./application/ports/role-repository.js";
import type { RolesVersionBumper } from "./application/ports/roles-version-bumper.js";
import { IamRoleGrantReader, type RoleGrantReader } from "./application/role-grant-reader.js";
import { SessionIssuer } from "./application/session-issuer.js";
import {
  IamUserIdentifierReader,
  type UserIdentifierReader,
} from "./application/user-identifier-reader.js";
import { GetMeUseCase } from "./application/use-cases/get-me.use-case.js";
import { LoginUseCase } from "./application/use-cases/login.use-case.js";
import { LogoutAllUseCase } from "./application/use-cases/logout-all.use-case.js";
import { LogoutUseCase } from "./application/use-cases/logout.use-case.js";
import { RefreshSessionUseCase } from "./application/use-cases/refresh-session.use-case.js";
import { ProvisionSystemRolesUseCase } from "./application/use-cases/provision-system-roles.use-case.js";
import { ReadUserProfileUseCase } from "./application/use-cases/read-user-profile.use-case.js";
import { RegisterUserUseCase } from "./application/use-cases/register-user.use-case.js";
import { UpdateMeUseCase } from "./application/use-cases/update-me.use-case.js";
import { ArchiveRoleUseCase } from "./application/use-cases/archive-role.use-case.js";
import { CreateRoleUseCase } from "./application/use-cases/create-role.use-case.js";
import { ListRolesUseCase } from "./application/use-cases/list-roles.use-case.js";
import { UpdateRoleUseCase } from "./application/use-cases/update-role.use-case.js";
import { Argon2PasswordHasher } from "./infrastructure/argon2-password-hasher.js";
import { InMemoryPermissionCache } from "./infrastructure/in-memory-permission-cache.js";
import { JwtTokenIssuer } from "./infrastructure/jwt-token-issuer.js";
import { MongoPlatformOperatorRepository } from "./infrastructure/mongo-platform-operator.repository.js";
import { MongoRefreshSessionRepository } from "./infrastructure/mongo-refresh-session.repository.js";
import { MongoRoleRepository } from "./infrastructure/mongo-role.repository.js";
import { MongoUnitOfWork } from "./infrastructure/mongo-unit-of-work.js";
import { RedisPermissionCache } from "./infrastructure/redis-permission-cache.js";
import { TwoTierPermissionCache } from "./infrastructure/two-tier-permission-cache.js";
import { MongoUserRepository } from "./infrastructure/mongo-user.repository.js";
import { IamPlatformOperatorLookup } from "./infrastructure/platform-operator-lookup.js";
import { AuthController } from "./presentation/auth.controller.js";
import { AuthCookies, PLATFORM_COOKIES } from "./presentation/auth-cookies.js";
import { PlatformAuthController } from "./presentation/platform-auth.controller.js";
import { buildPlatformAuthRouter } from "./presentation/platform-auth.router.js";
import { buildPlatformMeRouter } from "./presentation/platform-me.router.js";
import { AUTH_RATE_LIMIT } from "./domain/auth-limits.js";
import { buildAuthRouter } from "./presentation/auth.router.js";
import { RolesController } from "./presentation/roles.controller.js";
import { buildRolesRouter } from "./presentation/roles.router.js";
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
  const sessionIssuer = buildSessionIssuer(dependencies);
  const authController = new AuthController({
    registerUser: new RegisterUserUseCase({
      users,
      sessions,
      hasher,
      sessionIssuer,
      unitOfWork,
      events: kernelEventPublisher,
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

/** Builds refresh sessions and signs access tokens; shared by the admin and the platform auth routers. */
function buildSessionIssuer(dependencies: IamDependencies): SessionIssuer {
  const { config, clock } = dependencies;
  return new SessionIssuer({
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
}

export { buildEnsurePlatformAdminUseCase } from "./ensure-platform-admin.composition.js";
export type { SeededOperatorAudit } from "./ensure-platform-admin.composition.js";
export type { EnsurePlatformAdminUseCase } from "./application/use-cases/ensure-platform-admin.use-case.js";

/**
 * Creates the six system roles of a new organization. Organization creation calls it inside its
 * own transaction; the roles are written through that transaction.
 */
export function buildProvisionSystemRolesUseCase(clock: Clock): ProvisionSystemRolesUseCase {
  return new ProvisionSystemRolesUseCase({ roles: new MongoRoleRepository(), clock });
}

/** The read port other modules use to turn role IDs into role keys, in one query. */
export type RoleKeyReader = Pick<RoleRepository, "findRoleKeysByIds">;

export function buildRoleKeyReader(): RoleKeyReader {
  return new MongoRoleRepository();
}

/** The display name and language of a user, for modules that copy them into their own records. */
export function buildReadUserProfileUseCase(): ReadUserProfileUseCase {
  return new ReadUserProfileUseCase({ users: new MongoUserRepository() });
}

export type { ProvisionSystemRolesUseCase } from "./application/use-cases/provision-system-roles.use-case.js";
export type {
  ReadUserProfileUseCase,
  UserProfile,
} from "./application/use-cases/read-user-profile.use-case.js";

export { buildPermissionCatalog } from "./application/permission-catalog.js";
export type { PermissionCatalog } from "./application/permission-catalog.js";
export type {
  MemberAccessReader,
  MemberAssignment,
} from "./application/ports/member-access-reader.js";
export type { RolesVersionBumper } from "./application/ports/roles-version-bumper.js";

export interface PermissionGateDependencies {
  readonly catalog: PermissionCatalog;
  /** Implemented by core/organization, wired in routes/v1.ts. */
  readonly memberAccess: Pick<MemberAccessReader, "findAssignments">;
  readonly clock: Clock;
  /** Defaults to the in-process LRU cache; routes/v1.ts passes the two-tier cache from `buildPermissionCache`. */
  readonly cache?: PermissionCache;
}

export interface PermissionCacheOptions {
  readonly clock: Clock;
  /** Present in the API role: the in-process cache then sits in front of Redis. */
  readonly redis?: RedisClient;
}

/** Memory in front of Redis when a client is given, memory alone otherwise (ADR-088, ADR-090). */
export function buildPermissionCache(options: PermissionCacheOptions): PermissionCache {
  const memory = new InMemoryPermissionCache({ clock: options.clock });
  if (options.redis === undefined) return memory;
  return new TwoTierPermissionCache({
    memory,
    shared: new RedisPermissionCache({ client: options.redis }),
  });
}

/** The kernel PermissionGate: roles and assignments resolved to locations, behind a version-keyed cache (ADR-088). */
export function buildPermissionGate(dependencies: PermissionGateDependencies): PermissionGate {
  const { catalog, memberAccess, clock } = dependencies;
  return new IamPermissionGate({
    catalog,
    resolver: new PermissionResolver(catalog),
    cache: dependencies.cache ?? new InMemoryPermissionCache({ clock }),
    roles: new MongoRoleRepository(),
    members: memberAccess,
  });
}

export interface IamTenantRouterDependencies {
  readonly catalog: PermissionCatalog;
  readonly memberAccess: MemberAccessReader;
  readonly rolesVersion: RolesVersionBumper;
  readonly permission: PermissionMiddlewareFactory;
  /** The gate of the same request: role writes check the caller's grants (ADR-092). */
  readonly permissions: PermissionGate;
  readonly clock: Clock;
  readonly audit: AuditRecorder;
}

/** The role endpoints of `/orgs/{organizationId}`, mounted by routes/v1.ts behind the tenant pipeline. */
export function buildIamTenantRouter(dependencies: IamTenantRouterDependencies): Router {
  const { catalog, memberAccess, rolesVersion, permission, clock } = dependencies;
  const { audit, permissions } = dependencies;
  const roles = new MongoRoleRepository();
  const resolver = new PermissionResolver(catalog);
  const unitOfWork = new MongoUnitOfWork();
  const controller = new RolesController({
    listRoles: new ListRolesUseCase({ roles, members: memberAccess, resolver }),
    createRole: new CreateRoleUseCase({
      roles,
      rolesVersion,
      unitOfWork,
      events: kernelEventPublisher,
      catalog,
      resolver,
      clock,
      audit,
      permissions,
    }),
    updateRole: new UpdateRoleUseCase({
      roles,
      rolesVersion,
      unitOfWork,
      events: kernelEventPublisher,
      catalog,
      resolver,
      clock,
      audit,
      permissions,
    }),
    archiveRole: new ArchiveRoleUseCase({
      roles,
      members: memberAccess,
      rolesVersion,
      unitOfWork,
      events: kernelEventPublisher,
      resolver,
      clock,
      audit,
    }),
  });
  return buildRolesRouter(controller, permission);
}

/** Role lookups for the member and invitation endpoints: exists, ACTIVE, owner role, effective keys (ADR-092). */
export function buildRoleGrantReader(catalog: PermissionCatalog): RoleGrantReader {
  return new IamRoleGrantReader({
    roles: new MongoRoleRepository(),
    resolver: new PermissionResolver(catalog),
  });
}

/** The email and phone number of a user, for matching an invitation. Nothing else of the user is exposed. */
export function buildUserIdentifierReader(): UserIdentifierReader {
  return new IamUserIdentifierReader(new MongoUserRepository());
}

export type { RoleGrantInfo, RoleGrantReader } from "./application/role-grant-reader.js";
export type {
  IdentifierQuery,
  UserIdentifierReader,
  UserIdentifierView,
} from "./application/user-identifier-reader.js";

/** The kernel port behind `authenticatePlatform`: the ACTIVE operator of a signed-in user. */
export function buildPlatformOperatorLookup(): PlatformOperatorLookup {
  return new IamPlatformOperatorLookup(new MongoPlatformOperatorRepository());
}

/**
 * `/platform/auth`: login, refresh and logout of platform operators, on the PLATFORM audience with
 * their own cookies and rate-limit buckets (ADR-048). The same session machinery as `/auth`; only
 * the audience, the operator check and the cookie pair differ.
 */
export function buildIamPlatformAuthRouter(dependencies: IamDependencies): Router {
  const { config, clock, rateLimiter } = dependencies;
  const users = new MongoUserRepository();
  const sessions = new MongoRefreshSessionRepository();
  const operators = new MongoPlatformOperatorRepository();
  const sessionIssuer = buildSessionIssuer(dependencies);
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
      identifierLimit: AUTH_RATE_LIMIT.PLATFORM_LOGIN_PER_IDENTIFIER,
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

/** `GET /platform/me`, mounted by routes/platform.ts behind `authenticatePlatform`. */
export function buildIamPlatformMeRouter(): Router {
  return buildPlatformMeRouter(new GetMeUseCase({ users: new MongoUserRepository() }));
}
