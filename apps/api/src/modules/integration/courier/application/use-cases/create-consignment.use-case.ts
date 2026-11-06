import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import { COURIER_EVENT_TYPE } from "@banijjik/contracts/courier";
import { asId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import { AppError, forbidden } from "../../../../../kernel/http/index.js";
import { Consignment } from "../../domain/consignment.entity.js";
import { duplicateTrackingNumber } from "../../domain/errors.js";
import type { CourierDependencies } from "../courier-dependencies.js";

export interface CreateConsignmentInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly body: {
    readonly orderId: string;
    readonly courierKey: import("@banijjik/contracts/courier").ManualCourierKey;
    readonly trackingNumber: string;
    readonly shipOrder?: boolean | undefined;
  };
}

function assertLocation(locationId: string, allowedLocationIds: readonly string[] | "ALL"): void {
  if (allowedLocationIds === "ALL") return;
  if (!allowedLocationIds.includes(locationId)) throw forbidden();
}

export class CreateConsignmentUseCase {
  constructor(private readonly dependencies: CourierDependencies) {}

  async execute(input: CreateConsignmentInput): Promise<Consignment> {
    const orderId = asId<OrderId>(input.body.orderId);
    const order = await this.dependencies.orders.findOrder(input.organizationId, orderId);
    if (order === undefined) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.order_not_found" });
    }
    assertLocation(order.locationId, input.allowedLocationIds);
    if (order.fulfillment.method !== "COURIER") {
      throw new AppError({
        code: ERROR_CODE.BUSINESS_RULE,
        messageKey: "errors.courier_fulfillment_mismatch",
      });
    }

    const existing = await this.dependencies.consignments.findByTracking(
      input.organizationId,
      input.body.courierKey,
      input.body.trackingNumber,
    );
    if (existing !== undefined) {
      throw duplicateTrackingNumber(input.body.courierKey, input.body.trackingNumber);
    }

    const count = await this.dependencies.consignments.countByOrder(
      input.organizationId,
      orderId,
    );
    const now = this.dependencies.clock.now();
    const consignment = Consignment.create({
      organizationId: input.organizationId,
      locationId: order.locationId,
      orderId,
      attemptOrdinal: count + 1,
      courierKey: input.body.courierKey,
      trackingNumber: input.body.trackingNumber,
      actorUserId: input.actorUserId,
      now,
    });

    return this.persistAndPublish(input, consignment, order.version);
  }

  private async persistAndPublish(
    input: CreateConsignmentInput,
    consignment: Consignment,
    orderVersion: number,
  ): Promise<Consignment> {
    return this.dependencies.unitOfWork.run(async () => {
      const persisted = await this.dependencies.consignments.insert(consignment);

      if (input.body.shipOrder !== false) {
        await this.dependencies.orders.shipOrder({
          organizationId: input.organizationId,
          allowedLocationIds: input.allowedLocationIds,
          actorUserId: input.actorUserId,
          orderId: consignment.orderId,
          body: {
            version: orderVersion,
            dispatch: {
              method: "COURIER",
              consignmentId: persisted.consignmentId,
            },
          },
        });
      }

      await this.dependencies.events.publish(
        COURIER_EVENT_TYPE.CONSIGNMENT_CREATED,
        { consignmentId: persisted.consignmentId },
        { orderingKey: persisted.consignmentId },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.CONSIGNMENT_CREATED,
        entityType: AUDIT_ENTITY_TYPE.consignment,
        entityId: persisted.consignmentId,
        changes: {},
      });

      return persisted;
    });
  }
}
