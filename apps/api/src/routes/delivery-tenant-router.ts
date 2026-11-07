import { ALL_LOCATIONS, MEMBER_STATUS, type ModuleManifest, type Money } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  asId,
  type LocationId,
  type MemberId,
  type OrderId,
  type OrganizationId,
  type PaymentId,
} from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { MongoUnitOfWork } from "../kernel/db/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import { MongoMemberRepository } from "../modules/core/organization/index.js";
import {
  buildDeliveryTenantRouter,
  MongoDeliveryAssignmentRepository,
  MongoRiderCashHandoverRepository,
  type DeliveryApprovalPort,
  type DeliveryMemberPort,
  type DeliveryOrderPort,
  type DeliveryPaymentPort,
} from "../modules/commerce/delivery/index.js";
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
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { buildSalesTenantPorts } from "./sales-tenant-router.js";

export interface DeliveryModuleRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}

function buildOrderAdapter(input: DeliveryModuleRouterInput): DeliveryOrderPort {
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

function buildMemberAdapter(): DeliveryMemberPort {
  const members = new MongoMemberRepository();
  return {
    async isMemberAssignedToLocation(_orgId, memberId, locationId) {
      const member = await members.findById(asId<MemberId>(memberId));
      if (member === undefined || member.status !== MEMBER_STATUS.ACTIVE) return false;
      return member.assignments.some(
        (a: { readonly locationId: unknown }) =>
          a.locationId === ALL_LOCATIONS || a.locationId === locationId,
      );
    },
    async findMemberIdForUser(_orgId, userId) {
      const member = await members.findByUserId(userId);
      return member?.memberId;
    },
  };
}

function buildPaymentAdapter(): DeliveryPaymentPort {
  const payments = new MongoPaymentRepository();
  const claims = new MongoCollectionClaimRepository();
  const claimCollections = buildClaimCollectionsUseCase(claims);
  const releaseCollections = buildReleaseCollectionsUseCase(claims);
  return {
    async findPaymentsByIds(organizationId: OrganizationId, paymentIds: readonly PaymentId[]) {
      const results: {
        readonly paymentId: PaymentId;
        readonly amount: Money;
        readonly locationId: LocationId;
      }[] = [];
      for (const id of paymentIds) {
        const payment = await payments.findById(organizationId, id);
        if (payment !== undefined) {
          results.push({
            paymentId: payment.paymentId,
            amount: payment.amount,
            locationId: payment.locationId,
          });
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
}): DeliveryApprovalPort {
  const verifier = buildApprovalVerifier(input);
  return {
    async verifyApprovalToken({ token, riderCashHandoverId }) {
      await verifier.consume(token, {
        action: APPROVAL_ACTION.RIDER_HANDOVER_REVERSAL,
        subjectKey: riderCashHandoverId,
      });
    },
  };
}

export function buildDeliveryTenantModuleRouter(input: DeliveryModuleRouterInput): Router {
  return buildDeliveryTenantRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    assignments: new MongoDeliveryAssignmentRepository(),
    handovers: new MongoRiderCashHandoverRepository(),
    orders: buildOrderAdapter(input),
    members: buildMemberAdapter(),
    payments: buildPaymentAdapter(),
    approvals: buildApprovalAdapter(input),
  });
}
