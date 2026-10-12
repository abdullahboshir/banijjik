import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { Router } from "express";
import type { PlatformAuditRecorder } from "../kernel/audit/index.js";
import {
  authenticatePlatform,
  platformPermission,
  type AccessTokenVerifier,
} from "../kernel/auth/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import { runInOrganizationContext } from "../kernel/tenancy/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildPlatformAuditRecorder,
  buildPlatformAuditRouter,
} from "../modules/core/audit/index.js";
import {
  buildIamPlatformAuthRouter,
  buildIamPlatformMeRouter,
  buildPlatformOperatorLookup,
  buildUserIdentifierReader,
  type IamDependencies,
} from "../modules/core/iam/index.js";
import {
  buildConfigVersionBumper,
  buildOrganizationDirectory,
  buildOrganizationStatusUseCases,
} from "../modules/core/organization/index.js";
import {
  buildEntitlementPlatformRouter,
  buildModuleOverrideLister,
} from "../modules/platform/entitlement/index.js";
import { buildPackagePlatformRouter } from "../modules/platform/package/index.js";
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
    buildPlatformRouter({
      clock,
      registry: input.registry,
      platformAudit: buildPlatformAuditRecorder(clock),
    }),
  );
}

interface PlatformRouterInput {
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
  router.use(buildPlatformAuditRouter({ permission: platformPermission }));
  router.use(buildIamPlatformMeRouter());
  return router;
}
