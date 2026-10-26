import type { AppConfig } from "../config/index.js";
import { buildSmsPlatformRouter } from "../modules/integration/sms/index.js";
import { platformSmsAudit, buildSmsTestMessage } from "./sms-adapters.js";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { Router, type RequestHandler } from "express";
import type { PlatformAuditRecorder } from "../kernel/audit/index.js";
import {
  authenticatePlatform,
  platformPermission,
  requirePlatformOperatorId,
  type AccessTokenVerifier,
} from "../kernel/auth/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import { PER_USER_LIMIT, perUserLimit, type RateLimiter } from "../kernel/rate-limit/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildPlatformAuditRecorder,
  buildPlatformAuditRouter,
} from "../modules/core/audit/index.js";
import {
  buildIamPlatformAuthRouter,
  buildIamPlatformMeRouter,
  buildIamPlatformOperatorRouter,
  buildPlatformOperatorLookup,
  buildUserIdentifierReader,
  type IamDependencies,
} from "../modules/core/iam/index.js";
import {
  buildConfigVersionBumper,
  buildOrganizationDirectory,
  buildOrganizationStatusUseCases,
  buildChangeIndustryTemplateUseCase,
  buildOrganizationTemplateUsage,
} from "../modules/core/organization/index.js";
import {
  buildEntitlementPlatformRouter,
  buildModuleOverrideLister,
} from "../modules/platform/entitlement/index.js";
import { buildOperationsRouters } from "../modules/platform/operations/index.js";
import { buildPackagePlatformRouter } from "../modules/platform/package/index.js";
import {
  buildIndustryPlatformRouter,
  buildChangeIndustryTemplateRouter,
  buildIndustryTemplateMove,
  buildSettingDefinitionsRouter,
  settingCatalogFrom,
} from "../modules/platform/industry/index.js";
import {
  buildPackageUsage,
  buildSubscriptionAdminReader,
  buildSubscriptionPlatformRouter,
} from "../modules/platform/saas-billing/index.js";
import {
  buildTenantAdminRouter,
  type TenantLifecycle,
} from "../modules/platform/tenant-admin/index.js";

export interface PlatformApiInput {
  readonly dependencies: IamDependencies;
  readonly verifier: AccessTokenVerifier;
  readonly registry: ModuleRegistry;
  /** Counts every authenticated platform request against its operator; absent in tests that do not need it. */
  readonly userRateLimiter?: RateLimiter | undefined;
}

/**
 * Mounts the platform panel API (plan 1.8a). Sign-in is public; everything else needs an ACTIVE
 * platform operator. Like routes/v1.ts, this is a composition root: it hands modules their ports
 * and the context runner. Platform routes are not behind the tenant entitlement gate; each router
 * guards its routes with `platformPermission(key)` (decision 11).
 */
export function mountPlatformApi(router: Router, input: PlatformApiInput): void {
  const { clock } = input.dependencies;
  // logout-all lives in the platform auth router but needs a session; the rest of it is public.
  router.use(
    "/platform/auth/logout-all",
    authenticatePlatform({ verifier: input.verifier, operators: buildPlatformOperatorLookup() }),
  );
  router.use("/platform/auth", buildIamPlatformAuthRouter(input.dependencies));
  router.use(
    "/platform",
    authenticatePlatform({ verifier: input.verifier, operators: buildPlatformOperatorLookup() }),
    ...buildOperatorLimit(input),
    buildPlatformRouter({
      clock,
      config: input.dependencies.config,
      limiter: input.dependencies.rateLimiter,
      registry: input.registry,
      platformAudit: buildPlatformAuditRecorder(clock),
    }),
  );
}

function buildOperatorLimit(input: PlatformApiInput): readonly RequestHandler[] {
  if (input.userRateLimiter === undefined) return [];
  return [
    perUserLimit({
      limiter: input.userRateLimiter,
      clock: input.dependencies.clock,
      ...PER_USER_LIMIT.PLATFORM_OPERATOR,
      userKeyOf: requirePlatformOperatorId,
    }),
  ];
}

interface PlatformRouterInput {
  readonly config: AppConfig;
  readonly limiter: RateLimiter;
  readonly clock: Clock;
  readonly registry: ModuleRegistry;
  readonly platformAudit: PlatformAuditRecorder;
}

function buildLifecycle(platformAudit: PlatformAuditRecorder): TenantLifecycle {
  const statusUseCases = buildOrganizationStatusUseCases({
    platformAudit,
    // The event row of a suspension carries the organization it concerns (ADR-087).
    contextRunner: {
      run: (organizationId, work) => runInOrganizationContext(organizationId, work),
    },
  });
  const toInput = (change: { organizationId: string; actorUserId: string; reason: string }) => ({
    organizationId: asId<OrganizationId>(change.organizationId),
    actorUserId: asId<UserId>(change.actorUserId),
    reason: change.reason,
  });
  return {
    suspend: (change) => statusUseCases.suspend.execute(toInput(change)),
    reactivate: (change) => statusUseCases.reactivate.execute(toInput(change)),
  };
}

function mountPackageAndOperatorRoutes(
  router: Router,
  input: PlatformRouterInput,
  manifests: { all: () => ReturnType<ModuleRegistry["all"]> },
): void {
  const { clock, platformAudit } = input;
  router.use(
    "/packages",
    buildPackagePlatformRouter({
      clock,
      permission: platformPermission,
      platformAudit,
      manifests,
      usage: buildPackageUsage(),
    }),
  );
  router.use(
    "/operators",
    buildIamPlatformOperatorRouter({ clock, permission: platformPermission, platformAudit }),
  );
}

function mountIndustryRoutes(router: Router, input: PlatformRouterInput): void {
  const { clock, platformAudit } = input;
  const settings = settingCatalogFrom(input.registry);
  router.use(
    "/industry-templates",
    buildIndustryPlatformRouter({
      permission: platformPermission,
      clock,
      platformAudit,
      usage: buildOrganizationTemplateUsage(),
      settings,
    }),
  );
  router.use("/setting-definitions", buildSettingDefinitionsRouter(settings, platformPermission));
  router.use(
    "/organizations/:organizationId/change-industry-template",
    buildChangeIndustryTemplateRouter(
      buildChangeIndustryTemplateUseCase({
        platformAudit,
        contextRunner: {
          run: (organizationId, work) => runInOrganizationContext(organizationId, work),
        },
        templates: buildIndustryTemplateMove(),
      }),
      platformPermission,
    ),
  );
}

function buildPlatformRouter(input: PlatformRouterInput): Router {
  const { clock, registry, platformAudit } = input;
  const manifests = { all: () => registry.all() };
  const configVersion = buildConfigVersionBumper();
  const directory = buildOrganizationDirectory();
  const identifierReader = buildUserIdentifierReader();
  const router = Router();
  router.use(
    "/organizations",
    buildTenantAdminRouter({
      clock,
      permission: platformPermission,
      directory,
      lifecycle: buildLifecycle(platformAudit),
      subscriptions: buildSubscriptionAdminReader({ clock, platformAudit, configVersion }),
      overrides: buildModuleOverrideLister(),
      identifiers: {
        findIdentifiers: (userId) => identifierReader.findIdentifiers(asId<UserId>(userId)),
      },
    }),
  );
  router.use(
    "/organizations/:organizationId/module-overrides",
    buildEntitlementPlatformRouter({
      clock,
      permission: platformPermission,
      platformAudit,
      manifests,
      organizations: { exists: async (id) => (await directory.findById(id)) !== undefined },
      configVersion,
    }),
  );
  router.use(
    "/organizations/:organizationId/subscription",
    buildSubscriptionPlatformRouter({
      clock,
      permission: platformPermission,
      platformAudit,
      configVersion,
    }),
  );
  mountPackageAndOperatorRoutes(router, input, manifests);
  mountIndustryRoutes(router, input);
  const operations = buildOperationsRouters({ permission: platformPermission, platformAudit });
  router.use("/event-dead-letters", operations.deadLetters);
  router.use("/dead-outbox-events", operations.deadOutbox);
  router.use(buildPlatformAuditRouter({ permission: platformPermission }));
  router.use(buildIamPlatformMeRouter());
  mountSmsPlatformRouter({ router, input, clock, platformAudit });
  return router;
}

function mountSmsPlatformRouter({
  router,
  input,
  clock,
  platformAudit,
}: {
  router: Router;
  input: PlatformRouterInput;
  clock: Clock;
  platformAudit: PlatformAuditRecorder;
}): void {
  router.use(
    buildSmsPlatformRouter({
      config: input.config.sms,
      clock,
      limiter: input.limiter,
      permission: platformPermission,
      operatorId: requirePlatformOperatorId,
      audit: platformSmsAudit(platformAudit),
      message: buildSmsTestMessage(true),
    }),
  );
}
