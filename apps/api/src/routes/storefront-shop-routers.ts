import type { ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler, Router } from "express";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import type { RateLimiter } from "../kernel/rate-limit/index.js";
import { buildBookingStorefront } from "../modules/commerce/booking/index.js";
import { buildCatalogStorefront } from "../modules/commerce/catalog/index.js";
import { buildLocationManagementRepository } from "../modules/core/organization/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildWebsiteStorefrontRouterFor,
  type StorefrontSiteSources,
} from "../modules/commerce/website/index.js";
import { buildOrgStorefrontConfigReaderAdapter } from "./storefront-checkout-adapters.js";
import { buildStorefrontSurfaceCheckoutRouter } from "./storefront-checkout-router.js";

export function buildShopSurfaceRouters(input: {
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly limiter: RateLimiter;
  readonly isProduction: boolean;
  readonly siteSources: StorefrontSiteSources;
  readonly requireWebsiteModule: RequestHandler;
  readonly requireCatalogModule: RequestHandler;
  readonly requireBookingModule: RequestHandler;
}): {
  readonly websiteRouter: Router;
  readonly catalogRouter: Router;
  readonly bookingRouter: Router;
  readonly checkoutRouter: Router;
} {
  const orgStorefrontConfig = buildOrgStorefrontConfigReaderAdapter(
    input.orgConfig,
    input.manifests,
  );
  const readPublicLocationIds = async (organizationId: string) =>
    (await orgStorefrontConfig.readStorefrontConfig(organizationId)).publicLocationIds;
  return {
    websiteRouter: buildWebsiteStorefrontRouterFor({
      requireWebsiteModule: input.requireWebsiteModule,
      siteSources: input.siteSources,
      orgConfig: input.orgConfig,
      locations: buildLocationManagementRepository(),
      readPublicLocationIds,
    }),
    catalogRouter: buildCatalogStorefront({
      orgConfig: input.orgConfig,
      requireCatalogModule: input.requireCatalogModule,
    }),
    bookingRouter: buildBookingStorefront({
      orgConfig: input.orgConfig,
      requireBookingModule: input.requireBookingModule,
      clock: input.clock,
      manifests: input.manifests,
      readPublicLocationIds,
    }),
    checkoutRouter: buildStorefrontSurfaceCheckoutRouter({
      requireWebsiteModule: input.requireWebsiteModule,
      orgConfig: input.orgConfig,
      manifests: input.manifests,
      clock: input.clock,
      audit: input.audit,
      limiter: input.limiter,
      isProduction: input.isProduction,
    }),
  };
}
