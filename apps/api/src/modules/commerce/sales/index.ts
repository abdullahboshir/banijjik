import type { OrderRepository } from "./application/ports/sales-ports.js";
import { asId, type OrderId } from "@banijjik/ids";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { STOCK_MOVEMENT_REASON } from "@banijjik/contracts/inventory";
import type { RequestAdvanceReader } from "../payment/index.js";
import { movementValue, type InventoryPostingSource } from "../inventory/index.js";
import type { OrderPostingSnapshot, OrderPostingSource } from "../accounting/index.js";
import { MongoOrderRepository } from "./infrastructure/mongo-order.repositories.js";
import type { Router } from "express";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import {
  buildSalesController,
  buildSalesDependencies,
  buildSalesJobDependencies,
  buildSalesReturnController,
} from "./sales-wiring.js";
import type {
  SalesJobPorts,
  SalesTenantPorts,
  SalesTenantRouterDependencies,
} from "./sales-wiring.js";
import { buildExpireDraftsJob } from "./application/jobs/expire-drafts.job.js";
import { buildAutoCancelPlacedJob } from "./application/jobs/auto-cancel-placed.job.js";
import { buildSalesTenantRouter } from "./presentation/order-tenant.router.js";
import { buildSalesReturnTenantRouter } from "./presentation/sales-return-tenant.router.js";

export { salesManifest } from "./module.manifest.js";
export { registerSalesModels } from "./infrastructure/register-sales-models.js";
export { buildSalesController, buildSalesDependencies };
export type { SalesJobPorts, SalesTenantPorts, SalesTenantRouterDependencies };

export function buildSalesRouter(dependencies: SalesTenantRouterDependencies): Router {
  const router = buildSalesTenantRouter({
    controller: buildSalesController(buildSalesDependencies(dependencies)),
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
  router.use(
    buildSalesReturnTenantRouter({
      controller: buildSalesReturnController(dependencies),
      permission: dependencies.permission,
      idempotency: dependencies.idempotency,
    }),
  );
  return router;
}

/** Both hourly jobs run the module's own use cases, so their rules stay in one place. */
export function registerSalesScheduledJobs(ports: SalesJobPorts): void {
  const sales = buildSalesJobDependencies(ports);
  registerScheduledJob(buildExpireDraftsJob(sales));
  registerScheduledJob(buildAutoCancelPlacedJob(sales));
}

export type {
  OrderPaymentPort,
  OrderRepository,
  ReturnSettlementResult,
  SettleReturnInput,
} from "./application/ports/sales-ports.js";
export type { PaymentTotals } from "./domain/payment-status.js";

/** The composition root passes the order store to adapters that live outside this module. */
export function buildOrderRepository(): OrderRepository {
  return new MongoOrderRepository();
}

export function buildOrderSnapshotReader(): { read: OrderRepository["findById"] } {
  const orders = buildOrderRepository();
  return { read: (orderId: OrderId) => orders.findById(orderId) };
}

export interface OrderPostingSourcePorts {
  readonly orders: OrderRepository;
  readonly advances: RequestAdvanceReader;
  readonly inventory: InventoryPostingSource;
}

export function buildOrderPostingSourceAdapter(ports: OrderPostingSourcePorts): OrderPostingSource {
  return {
    async readOrder(orderId: string): Promise<OrderPostingSnapshot | undefined> {
      const order = await ports.orders.findById(asId<OrderId>(orderId));
      if (order === undefined) return undefined;

      const currency = order.totals.grandTotal.currency;
      const heldAdvance = await ports.advances.readHeldAdvance({
        organizationId: order.organizationId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        requestId: order.orderId,
        currency,
      });

      const movements = await ports.inventory.readMovements({
        organizationId: order.organizationId,
        sourceId: order.orderId,
      });

      const saleMovements = movements.filter((m) => m.reason === STOCK_MOVEMENT_REASON.SALE);
      const cogsAmount = saleMovements.reduce((sum, m) => sum + movementValue(m), 0);

      return {
        orderId: order.orderId,
        businessDate: order.businessDate,
        locationId: order.locationId,
        totals: order.totals,
        advancesToSettle: { amount: heldAdvance.amount, currency },
        cogs: { amount: cogsAmount, currency },
      };
    },
  };
}
