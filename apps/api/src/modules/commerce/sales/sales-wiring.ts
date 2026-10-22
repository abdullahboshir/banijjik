import type { ModuleManifest } from "@banijjik/contracts";
import type { RequestHandler } from "express";
import type { LimitGuard, PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { OrgConfigService } from "../../platform/entitlement/index.js";
import { buildSalesContactReader } from "../contact/index.js";
import { buildSalesSettingsReader } from "./application/sales-settings-reader.js";
import type { SalesDependencies, SalesJobDependencies } from "./application/sales-dependencies.js";
import type {
  PaymentSummaryReader,
  SalesApprovalVerifier,
  SalesCurrencyReader,
  SalesOwnerReader,
  SalesQuoter,
  SalesStockLedger,
  SalesUnitCostReader,
} from "./application/ports/sales-ports.js";
import { CreateOrderUseCase } from "./application/use-cases/create-order.use-case.js";
import { DeleteDraftUseCase } from "./application/use-cases/delete-draft.use-case.js";
import { InstantOrderUseCase } from "./application/use-cases/instant-order.use-case.js";
import { PlaceOrderUseCase } from "./application/use-cases/place-order.use-case.js";
import {
  GetOrderUseCase,
  ListOrdersUseCase,
} from "./application/use-cases/read-order.use-cases.js";
import {
  CancelOrderUseCase,
  CompleteOrderUseCase,
  ConfirmOrderUseCase,
  PackOrderUseCase,
} from "./application/use-cases/transition-order.use-cases.js";
import { UpdateOrderUseCase } from "./application/use-cases/update-order.use-case.js";
import { buildSalesCatalogReader } from "./infrastructure/sales-catalog.adapter.js";
import { buildSalesTimeZoneReader } from "./infrastructure/sales-org.adapter.js";
import {
  MongoOrderCounter,
  MongoOrderRepository,
} from "./infrastructure/mongo-order.repositories.js";
import { OrderController } from "./presentation/order.controller.js";

/**
 * The ports this module cannot build itself: pricing's quoter, inventory's ledger, iam's
 * approval verifier, the entitlement limit guard, the organization currency and owner reads, the
 * payment projection and the unit-cost reader. Routes adapts them, tests pass fakes.
 */
export interface SalesTenantPorts {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly quoter: SalesQuoter;
  readonly stock: SalesStockLedger;
  readonly approvals: SalesApprovalVerifier;
  readonly limits: LimitGuard;
  readonly owner: SalesOwnerReader;
  readonly currency: SalesCurrencyReader;
  readonly unitCosts: SalesUnitCostReader;
  readonly payments: PaymentSummaryReader;
}

/** The composition root of the module: repositories and ports, never wired anywhere else. */
export function buildSalesDependencies(ports: SalesTenantPorts): SalesDependencies {
  return {
    orders: new MongoOrderRepository(),
    counter: new MongoOrderCounter(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: ports.audit,
    clock: ports.clock,
    quoter: ports.quoter,
    catalog: buildSalesCatalogReader(),
    contacts: buildSalesContactReader(),
    timeZone: buildSalesTimeZoneReader(),
    currency: ports.currency,
    settings: buildSalesSettingsReader({
      orgConfig: ports.orgConfig,
      manifests: ports.manifests,
    }),
    stock: ports.stock,
    approvals: ports.approvals,
    payments: ports.payments,
    limits: ports.limits,
    owner: ports.owner,
    unitCosts: ports.unitCosts,
  };
}

export function buildSalesController(dependencies: SalesDependencies): OrderController {
  return new OrderController({
    createOrder: new CreateOrderUseCase(dependencies),
    updateOrder: new UpdateOrderUseCase(dependencies),
    deleteDraft: new DeleteDraftUseCase(dependencies),
    placeOrder: new PlaceOrderUseCase(dependencies),
    instantOrder: new InstantOrderUseCase(dependencies),
    confirmOrder: new ConfirmOrderUseCase(dependencies),
    packOrder: new PackOrderUseCase(dependencies),
    completeOrder: new CompleteOrderUseCase(dependencies),
    cancelOrder: new CancelOrderUseCase(dependencies),
    getOrder: new GetOrderUseCase(dependencies),
    listOrders: new ListOrdersUseCase(dependencies),
  });
}

export interface SalesTenantRouterDependencies extends SalesTenantPorts {
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
}

/**
 * What the worker needs for the two hourly jobs: the ledger to release stock, the payment stub for
 * the cancelled order's view, and the settings of the module. Jobs never quote or approve.
 */
export interface SalesJobPorts {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
  readonly stock: SalesStockLedger;
  readonly payments: PaymentSummaryReader;
}

export function buildSalesJobDependencies(ports: SalesJobPorts): SalesJobDependencies {
  return {
    orders: new MongoOrderRepository(),
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: ports.audit,
    clock: ports.clock,
    settings: buildSalesSettingsReader({
      orgConfig: ports.orgConfig,
      manifests: ports.manifests,
    }),
    stock: ports.stock,
    payments: ports.payments,
  };
}
