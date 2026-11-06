import type { Money } from "@banijjik/contracts/delivery";
import type {
  LocationId,
  OrderId,
  OrganizationId,
  PaymentId,
  RiderCashHandoverId,
  UserId,
} from "@banijjik/ids";
import type { PermissionMiddlewareFactory } from "../../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../../kernel/audit/index.js";
import type { Clock } from "../../../../kernel/time/index.js";
import type {
  DeliveryAssignmentRepository,
  RiderCashHandoverRepository,
} from "../domain/delivery-repository.js";

export interface DeliveryUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}

export interface DeliveryEventPublisher {
  publish(type: string, payload: unknown, options?: { readonly orderingKey?: string }): Promise<void>;
}

export interface DeliveryOrderPort {
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
      readonly dispatch: { readonly method: "OWN_RIDER"; readonly deliveryAssignmentId: string };
    };
  }) => Promise<unknown>;
}

export interface DeliveryMemberPort {
  readonly isMemberAssignedToLocation: (
    organizationId: OrganizationId,
    memberId: string,
    locationId: LocationId,
  ) => Promise<boolean>;
  readonly findMemberIdForUser: (
    organizationId: OrganizationId,
    userId: UserId,
  ) => Promise<string | undefined>;
}

export interface DeliveryPaymentPort {
  readonly findPaymentsByIds: (
    organizationId: OrganizationId,
    paymentIds: readonly PaymentId[],
  ) => Promise<readonly { readonly paymentId: PaymentId; readonly amount: Money; readonly locationId: LocationId }[]>;
}

export interface DeliveryApprovalPort {
  readonly verifyApprovalToken: (input: {
    readonly organizationId: OrganizationId;
    readonly riderCashHandoverId: RiderCashHandoverId;
    readonly token: string;
    readonly action: string;
  }) => Promise<void>;
}

export interface DeliveryDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly events: DeliveryEventPublisher;
  readonly unitOfWork: DeliveryUnitOfWork;
  readonly assignments: DeliveryAssignmentRepository;
  readonly handovers: RiderCashHandoverRepository;
  readonly orders: DeliveryOrderPort;
  readonly members: DeliveryMemberPort;
  readonly payments: DeliveryPaymentPort;
  readonly approvals: DeliveryApprovalPort;
}

export interface DeliveryRouterDependencies extends DeliveryDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: import("express").RequestHandler;
}
