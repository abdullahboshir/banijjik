import { PACKAGE_STATUS } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type { Router } from "express";
import type { PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import type { ConfigVersionBumper } from "../../../kernel/tenancy/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { buildPackageReader, buildPackageReferenceGuard } from "../package/index.js";
import type { SubscriptionReader } from "./application/ports/subscription-repository.js";
import type { PackageKindLookup } from "./application/ports/subscription-admin-ports.js";
import { ChangePackageUseCase } from "./application/use-cases/change-package.use-case.js";
import { ExtendTrialUseCase } from "./application/use-cases/extend-trial.use-case.js";
import { GetSubscriptionUseCase } from "./application/use-cases/get-subscription.use-case.js";
import { type SubscriptionAdminDependencies } from "./application/use-cases/subscription-admin-dependencies.js";
import { MongoSubscriptionAdminRepository } from "./infrastructure/mongo-subscription-admin.repository.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { SubscriptionController } from "./presentation/subscription.controller.js";
import { buildSubscriptionRouter } from "./presentation/subscription.router.js";
import { StartTrialUseCase } from "./application/use-cases/start-trial.use-case.js";
import { MongoSubscriptionRepository } from "./infrastructure/mongo-subscription.repository.js";

export { accessModeOf } from "./domain/access-mode.js";
export type { AccessState, SubscriptionDates } from "./domain/access-mode.js";
export { registerSaasBillingModels } from "./infrastructure/register-saas-billing-models.js";
export { saasBillingManifest } from "./module.manifest.js";
export type { SubscriptionReader } from "./application/ports/subscription-repository.js";
export type { SubscriptionView } from "./application/subscription-view.js";

/** The port core/organization calls inside its create transaction. */
export interface TrialStarter {
  start(organizationId: OrganizationId): Promise<void>;
}

export function buildTrialStarter(clock: Clock): TrialStarter {
  const packages = buildPackageReader();
  const useCase = new StartTrialUseCase({
    subscriptions: new MongoSubscriptionRepository(),
    basePackages: {
      findActiveBasePackageId: async (packageKey) =>
        (await packages.findActiveBaseByKey(packageKey))?.packageId,
    },
    clock,
  });
  return { start: (organizationId) => useCase.execute(organizationId) };
}

/** The read side for entitlement. */
export function buildSubscriptionReader(): SubscriptionReader {
  return new MongoSubscriptionRepository();
}

export type { SubscriptionDetail } from "./application/use-cases/subscription-detail.js";

export interface SubscriptionPlatformDependencies {
  readonly clock: Clock;
  readonly platformAudit: PlatformAuditRecorder;
  /** Implemented by core/organization, wired in routes/v1.ts. */
  readonly configVersion: ConfigVersionBumper;
}

function buildPackageKindLookup(): PackageKindLookup {
  const packages = buildPackageReader();
  const guard = buildPackageReferenceGuard();
  return {
    touchActive: (packageIds) => guard.touchActive(packageIds),
    findByIds: async (packageIds) =>
      (await packages.findByIds(packageIds)).map((entry) => ({
        packageId: entry.packageId,
        packageKey: entry.packageKey,
        isAddOn: entry.isAddOn,
        isActive: entry.status === PACKAGE_STATUS.ACTIVE,
      })),
  };
}

function buildAdminDependencies(
  dependencies: SubscriptionPlatformDependencies,
): SubscriptionAdminDependencies {
  return {
    subscriptions: new MongoSubscriptionAdminRepository(),
    packages: buildPackageKindLookup(),
    configVersion: dependencies.configVersion,
    unitOfWork: new MongoUnitOfWork(),
    platformAudit: dependencies.platformAudit,
    clock: dependencies.clock,
  };
}

/** `/platform/organizations/{organizationId}/subscription`, mounted by routes/v1.ts behind `authenticatePlatform`. */
export function buildSubscriptionPlatformRouter(
  dependencies: SubscriptionPlatformDependencies & {
    readonly permission: PlatformPermissionMiddlewareFactory;
  },
): Router {
  const shared = buildAdminDependencies(dependencies);
  const controller = new SubscriptionController({
    getSubscription: new GetSubscriptionUseCase(shared),
    extendTrial: new ExtendTrialUseCase(shared),
    changePackage: new ChangePackageUseCase(shared),
  });
  return buildSubscriptionRouter(controller, dependencies.permission);
}

/** The reads of the tenant list and detail. They run as system access themselves (PLATFORM_ADMIN). */
export function buildSubscriptionAdminReader(
  dependencies: SubscriptionPlatformDependencies,
): GetSubscriptionUseCase {
  return new GetSubscriptionUseCase(buildAdminDependencies(dependencies));
}

/** Is a package the base or an add-on of a running subscription? Wired into the package module by routes/v1.ts. */
export function buildPackageUsage(): { isInUse(packageId: string): Promise<boolean> } {
  const subscriptions = new MongoSubscriptionAdminRepository();
  return { isInUse: (packageId) => subscriptions.isPackageInUse(packageId) };
}
