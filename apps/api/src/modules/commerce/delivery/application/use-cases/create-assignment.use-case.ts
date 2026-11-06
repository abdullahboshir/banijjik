import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  DELIVERY_EVENT_TYPE,
  ERROR_CODE,
} from "@banijjik/contracts";
import type { CreateDeliveryAssignmentBody } from "@banijjik/validation/delivery";
import { asId, type OrderId, type OrganizationId, type UserId } from "@banijjik/ids";
import { AppError, forbidden } from "../../../../../kernel/http/index.js";
import { DeliveryAssignment } from "../../domain/delivery-assignment.entity.js";
import {
  deliveryFulfillmentMismatch,
  riderNotAssignedToLocation,
} from "../../domain/errors.js";
import type { DeliveryDependencies } from "../delivery-dependencies.js";

export interface CreateAssignmentInput {
  readonly organizationId: OrganizationId;
  readonly allowedLocationIds: readonly string[] | "ALL";
  readonly actorUserId: UserId;
  readonly body: CreateDeliveryAssignmentBody;
}

function assertLocation(locationId: string, allowedLocationIds: readonly string[] | "ALL"): void {
  if (allowedLocationIds === "ALL") return;
  if (!allowedLocationIds.includes(locationId)) throw forbidden();
}

export class CreateDeliveryAssignmentUseCase {
  constructor(private readonly dependencies: DeliveryDependencies) {}

  async execute(input: CreateAssignmentInput): Promise<DeliveryAssignment> {
    const orderId = asId<OrderId>(input.body.orderId);
    const order = await this.dependencies.orders.findOrder(input.organizationId, orderId);
    if (order === undefined) {
      throw new AppError({ code: ERROR_CODE.NOT_FOUND, messageKey: "errors.order_not_found" });
    }
    assertLocation(order.locationId, input.allowedLocationIds);
    if (order.fulfillment.method !== "OWN_RIDER") {
      throw deliveryFulfillmentMismatch();
    }

    const isAssigned = await this.dependencies.members.isMemberAssignedToLocation(
      input.organizationId,
      input.body.riderMemberId,
      order.locationId,
    );
    if (!isAssigned) {
      throw riderNotAssignedToLocation(input.body.riderMemberId);
    }

    const count = await this.dependencies.assignments.countByOrder(
      input.organizationId,
      orderId,
    );
    const now = this.dependencies.clock.now();
    const assignment = DeliveryAssignment.create({
      organizationId: input.organizationId,
      locationId: order.locationId,
      orderId,
      riderMemberId: input.body.riderMemberId,
      attemptOrdinal: count + 1,
      notes: input.body.notes,
      actorUserId: input.actorUserId,
      now,
    });

    return this.persistAndPublish(input, assignment, order.version);
  }

  private async persistAndPublish(
    input: CreateAssignmentInput,
    assignment: DeliveryAssignment,
    orderVersion: number,
  ): Promise<DeliveryAssignment> {
    return this.dependencies.unitOfWork.run(async () => {
      const persisted = await this.dependencies.assignments.insert(assignment);

      if (input.body.shipOrder !== false) {
        await this.dependencies.orders.shipOrder({
          organizationId: input.organizationId,
          allowedLocationIds: input.allowedLocationIds,
          actorUserId: input.actorUserId,
          orderId: assignment.orderId,
          body: {
            version: orderVersion,
            dispatch: {
              method: "OWN_RIDER",
              deliveryAssignmentId: persisted.deliveryAssignmentId,
            },
          },
        });
      }

      await this.dependencies.events.publish(
        DELIVERY_EVENT_TYPE.ASSIGNMENT_CREATED,
        { deliveryAssignmentId: persisted.deliveryAssignmentId },
        { orderingKey: persisted.deliveryAssignmentId },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.DELIVERY_ASSIGNMENT_CREATED,
        entityType: AUDIT_ENTITY_TYPE.deliveryAssignment,
        entityId: persisted.deliveryAssignmentId,
        changes: {},
      });

      return persisted;
    });
  }
}
