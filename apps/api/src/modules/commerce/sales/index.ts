import type { OrderRepository } from "./application/ports/sales-ports.js";
import type { OrderId } from "@banijjik/ids";
import { MongoOrderRepository } from "./infrastructure/mongo-order.repositories.js";
import type { Router } from "express";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import {
  buildSalesController,
  buildSalesDependencies,
  buildSalesJobDependencies,
} from "./sales-wiring.js";
import type {
  SalesJobPorts,
  SalesTenantPorts,
  SalesTenantRouterDependencies,
} from "./sales-wiring.js";
import { buildExpireDraftsJob } from "./application/jobs/expire-drafts.job.js";
import { buildAutoCancelPlacedJob } from "./application/jobs/auto-cancel-placed.job.js";
import { buildSalesTenantRouter } from "./presentation/order-tenant.router.js";

export { salesManifest } from "./module.manifest.js";
export { registerSalesModels } from "./infrastructure/register-sales-models.js";
export { buildSalesController, buildSalesDependencies };
export type { SalesJobPorts, SalesTenantPorts, SalesTenantRouterDependencies };

export function buildSalesRouter(dependencies: SalesTenantRouterDependencies): Router {
  return buildSalesTenantRouter({
    controller: buildSalesController(buildSalesDependencies(dependencies)),
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}

/** Both hourly jobs run the module's own use cases, so their rules stay in one place. */
export function registerSalesScheduledJobs(ports: SalesJobPorts): void {
  const sales = buildSalesJobDependencies(ports);
  registerScheduledJob(buildExpireDraftsJob(sales));
  registerScheduledJob(buildAutoCancelPlacedJob(sales));
}

export type { OrderPaymentPort, OrderRepository } from "./application/ports/sales-ports.js";
export type { PaymentTotals } from "./domain/payment-status.js";
export function buildOrderSnapshotReader(): { read: OrderRepository["findById"] } {
  const orders = new MongoOrderRepository();
  return { read: (orderId: OrderId) => orders.findById(orderId) };
}
