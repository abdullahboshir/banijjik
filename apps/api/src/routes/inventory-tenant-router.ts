import type { ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { rateLimit, type RateLimiter } from "../kernel/rate-limit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildInventoryRouter } from "../modules/commerce/inventory/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";

export interface InventoryRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly rateLimiter: RateLimiter;
}

function rebuildRateLimitOf(limiter: RateLimiter): RequestHandler {
  return rateLimit({
    limiter,
    bucket: "inventory-rebuild",
    limit: 1,
    windowSeconds: 60,
    keyOf: (request) => String(request.params["organizationId"] ?? "unknown"),
  });
}

/** Inventory routes (card 3.3), mounted on the tenant pipeline. */
export function buildInventoryTenantRouter(input: InventoryRouterInput): Router {
  return buildInventoryRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
    rebuildRateLimit: rebuildRateLimitOf(input.rateLimiter),
  });
}
