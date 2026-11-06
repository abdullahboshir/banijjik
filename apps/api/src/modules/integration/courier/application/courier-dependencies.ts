import type { Money } from "@banijjik/contracts/courier";
import type { CourierSettlementId, LocationId, OrderId, OrganizationId, PaymentId, UserId } from "@banijjik/ids";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type { ConsignmentRepository, CourierSettlementRepository } from "../domain/courier-repository.js";

export interface CourierUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface CourierEventPublisher {
  publish(type: string, payload: unknown, options?: { readonly orderingKey?: string }): Promise<void>;
}

export interface CourierOrderPort {
  readonly findOrder: (
    organizationId: OrganizationId,
    orderId: OrderId,
  ) => Promise<
    | {
        readonly orderId: OrderId;
        readonly locationId: LocationId;
        readonly status: string;
        readonly version: number;
        readonly fulfillment: { readonly method: string };
      }
    | undefined
  >;
  readonly shipOrder: (input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly actorUserId: UserId;
    readonly orderId: OrderId;
    readonly body: {
      readonly version: number;
      readonly dispatch: { readonly method: "COURIER"; readonly consignmentId: string };
    };
  }) => Promise<unknown>;
}

export interface CourierPaymentPort {
  readonly findPaymentsByIds: (
    organizationId: OrganizationId,
    paymentIds: readonly PaymentId[],
  ) => Promise<readonly { readonly paymentId: PaymentId; readonly amount: Money }[]>;
}

export interface CourierApprovalPort {
  readonly verifyApprovalToken: (input: {
    readonly organizationId: OrganizationId;
    readonly courierSettlementId: CourierSettlementId;
    readonly token: string;
    readonly action: string;
  }) => Promise<void>;
}

export interface CourierDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly events: CourierEventPublisher;
  readonly unitOfWork: CourierUnitOfWork;
  readonly consignments: ConsignmentRepository;
  readonly courierSettlements: CourierSettlementRepository;
  readonly orders: CourierOrderPort;
  readonly payments: CourierPaymentPort;
  readonly approvals: CourierApprovalPort;
}

export interface CourierRouterDependencies extends CourierDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: import("express").RequestHandler;
}
