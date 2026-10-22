import type { Router } from "express";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import { buildSalesController, buildSalesDependencies } from "./sales-wiring.js";
import type { SalesTenantPorts, SalesTenantRouterDependencies } from "./sales-wiring.js";
import { buildExpireDraftsJob } from "./application/jobs/expire-drafts.job.js";
import { buildAutoCancelPlacedJob } from "./application/jobs/auto-cancel-placed.job.js";
import { buildSalesTenantRouter } from "./presentation/order-tenant.router.js";

export { salesManifest } from "./module.manifest.js";
export { registerSalesModels } from "./infrastructure/register-sales-models.js";
export { buildSalesController, buildSalesDependencies };
export type { SalesTenantPorts, SalesTenantRouterDependencies };

export function buildSalesRouter(dependencies: SalesTenantRouterDependencies): Router {
  return buildSalesTenantRouter({
    controller: buildSalesController(buildSalesDependencies(dependencies)),
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}

/** Both hourly jobs run the module's own use cases, so their rules stay in one place. */
export function registerSalesScheduledJobs(dependencies: SalesTenantPorts): void {
  const sales = buildSalesDependencies(dependencies);
  registerScheduledJob(buildExpireDraftsJob(sales));
  registerScheduledJob(buildAutoCancelPlacedJob(sales));
}
