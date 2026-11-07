import type { ModuleManifest } from "@banijjik/contracts";
import type { Money } from "@banijjik/contracts/courier";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import type { OrderId, OrganizationId, PaymentId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import {
  MongoCollectionClaimRepository,
  MongoPaymentRepository,
  buildClaimCollectionsUseCase,
  buildReleaseCollectionsUseCase,
} from "../modules/commerce/payment/index.js";
import {
  buildSalesDependencies,
  MongoOrderRepository,
  ShipOrderUseCase,
} from "../modules/commerce/sales/index.js";
import {
  buildCourierTenantRouter,
  MongoConsignmentRepository,
  MongoCourierSettlementRepository,
  type CourierApprovalPort,
  type CourierOrderPort,
  type CourierPaymentPort,
} from "../modules/integration/courier/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildSalesTenantPorts } from "./sales-tenant-router.js";

export interface CourierModuleRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

function buildOrderAdapter(input: CourierModuleRouterInput): CourierOrderPort {
  const orders = new MongoOrderRepository();
  return {
    async findOrder(organizationId: OrganizationId, orderId: OrderId) {
      const order = await orders.findById(orderId);
      if (order === undefined || order.organizationId !== organizationId) return undefined;
      return {
        orderId: order.orderId,
        locationId: order.locationId,
        status: order.status,
        version: order.version,
        fulfillment: order.fulfillment,
      };
    },
    async shipOrder(shipInput) {
      const salesPorts = buildSalesTenantPorts({
        clock: input.clock,
        audit: input.audit,
        permission: input.permission,
        permissions: input.permissions,
        idempotency: input.idempotency,
        orgConfig: input.orgConfig,
        manifests: input.manifests,
      });
      const useCase = new ShipOrderUseCase(buildSalesDependencies(salesPorts));
      return useCase.execute(shipInput);
    },
  };
}

function buildPaymentAdapter(): CourierPaymentPort {
  const payments = new MongoPaymentRepository();
  const claims = new MongoCollectionClaimRepository();
  const claimCollections = buildClaimCollectionsUseCase(claims);
  const releaseCollections = buildReleaseCollectionsUseCase(claims);
  return {
    async findPaymentsByIds(organizationId: OrganizationId, paymentIds: readonly PaymentId[]) {
      const results: { readonly paymentId: PaymentId; readonly amount: Money }[] = [];
      for (const id of paymentIds) {
        const payment = await payments.findById(organizationId, id);
        if (payment !== undefined) {
          results.push({ paymentId: payment.paymentId, amount: payment.amount });
        }
      }
      return results;
    },
    async claimCollections(claimInput) {
      await claimCollections.execute(claimInput);
    },
    async releaseCollections(releaseInput) {
      await releaseCollections.execute(releaseInput);
    },
  };
}

function buildApprovalAdapter(input: {
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}): CourierApprovalPort {
  const verifier = buildApprovalVerifier(input);
  return {
    async verifyApprovalToken({ token, courierSettlementId }) {
      await verifier.consume(token, {
        action: APPROVAL_ACTION.COURIER_SETTLEMENT_REVERSAL,
        subjectKey: courierSettlementId,
      });
    },
  };
}

export function buildCourierTenantModuleRouter(input: CourierModuleRouterInput): Router {
  return buildCourierTenantRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    consignments: new MongoConsignmentRepository(),
    courierSettlements: new MongoCourierSettlementRepository(),
    orders: buildOrderAdapter(input),
    payments: buildPaymentAdapter(),
    approvals: buildApprovalAdapter(input),
  });
}
