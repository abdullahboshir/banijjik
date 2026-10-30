import { OFFERING_KIND } from "@banijjik/contracts";
import type { OrderRepository } from "./application/ports/sales-ports.js";
import { asId, type OrderId } from "@banijjik/ids";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { STOCK_MOVEMENT_REASON } from "@banijjik/contracts/inventory";
import type { RequestAdvanceReader } from "../payment/index.js";
import { movementValue, type InventoryPostingSource } from "../inventory/index.js";
import type { OrderPostingSnapshot, OrderPostingSource } from "../accounting/index.js";
import { MongoOrderRepository } from "./infrastructure/mongo-order.repositories.js";
import { MongoSalesReturnRepository } from "./infrastructure/mongo-sales-return.repository.js";
import type { SalesReturnRepository } from "./application/ports/sales-return-ports.js";
import type { Router } from "express";
import { registerScheduledJob } from "../../../kernel/jobs/index.js";
import {
  buildSalesController,
  buildSalesDependencies,
  buildSalesExchangeController,
  buildSalesJobDependencies,
  buildSalesReturnController,
  buildSalesReturnDependencies,
} from "./sales-wiring.js";
import {
  CreateSalesReturnUseCase,
  type SalesReturnWriteInput,
} from "./application/use-cases/sales-return.use-cases.js";
import type { SalesReturnResponse } from "@banijjik/contracts/sales";
import type {
  SalesJobPorts,
  SalesTenantPorts,
  SalesTenantRouterDependencies,
} from "./sales-wiring.js";
import { buildExpireDraftsJob } from "./application/jobs/expire-drafts.job.js";
import { buildAutoCancelPlacedJob } from "./application/jobs/auto-cancel-placed.job.js";
import { buildSalesTenantRouter } from "./presentation/order-tenant.router.js";
import { buildSalesExchangeTenantRouter } from "./presentation/sales-exchange-tenant.router.js";
import { buildSalesReturnTenantRouter } from "./presentation/sales-return-tenant.router.js";
import {
  buildInstantSaleService,
  type InstantSaleInput,
  type InstantSaleService,
  type PreparedInstantSale,
} from "./application/instant-sale.service.js";

export { salesManifest } from "./module.manifest.js";
export { registerSalesModels } from "./infrastructure/register-sales-models.js";
export { buildSalesController, buildSalesDependencies };
export { buildStorefrontOrderCommands } from "./application/storefront-order-commands.js";
export type { PublicOrderCommands } from "@banijjik/contracts/website";
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
  router.use(
    buildSalesExchangeTenantRouter({
      controller: buildSalesExchangeController(dependencies),
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
  ReceivedOrderPayment,
  ReturnSettlementResult,
  SettleReturnInput,
} from "./application/ports/sales-ports.js";
export type { PaymentTotals } from "./domain/payment-status.js";
export { buildSalesReturnPostingSourceAdapter } from "./infrastructure/sales-return-posting-source.adapter.js";
export function buildSalesReturnRepository(): SalesReturnRepository {
  return new MongoSalesReturnRepository();
}

export type { InstantSaleInput, InstantSaleService, PreparedInstantSale };
export {
  buildOrderTotalsReader,
  type OrderTotalsReader,
  type OrderTotalsRow,
} from "./infrastructure/mongo-order-totals.reader.js";

/** The instant sale in two steps, for the POS that owns the unit of work (plan 3.9 decision 4). */
export function buildInstantSale(ports: SalesTenantPorts): InstantSaleService {
  return buildInstantSaleService(buildSalesDependencies(ports));
}

export interface PosSalesReturnService {
  create(input: SalesReturnWriteInput): Promise<SalesReturnResponse>;
}

/** The return use case for a POS till return, which sets `posSessionId` on the refund (card 3.9 A2-4). */
export function buildPosSalesReturn(ports: SalesTenantPorts): PosSalesReturnService {
  const useCase = new CreateSalesReturnUseCase(buildSalesReturnDependencies(ports));
  return { create: (input) => useCase.execute(input) };
}
export type { SalesReturnWriteInput };

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
        serviceGoods: {
          amount: order.lines
            .filter((line) => line.kind === OFFERING_KIND.SERVICE)
            .reduce(
              (sum, line) =>
                sum + line.lineNetTotal.amount + line.lineDiscount.amount - line.lineTax.amount,
              0,
            ),
          currency,
        },
        advancesToSettle: { amount: heldAdvance.amount, currency },
        cogs: { amount: cogsAmount, currency },
      };
    },
  };
}
