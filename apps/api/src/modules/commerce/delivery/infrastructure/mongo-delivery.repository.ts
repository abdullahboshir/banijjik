import {
  asId,
  type DeliveryAssignmentId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type RiderCashHandoverId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { DeliveryAssignment } from "../domain/delivery-assignment.entity.js";
import type {
  DeliveryAssignmentFilters,
  DeliveryAssignmentPage,
  DeliveryAssignmentRepository,
  RiderCashHandoverRepository,
} from "../domain/delivery-repository.js";
import { RiderCashHandover } from "../domain/rider-cash-handover.entity.js";
import {
  DELIVERY_ASSIGNMENT_MODEL_NAME,
  type DeliveryAssignmentDocument,
  RIDER_CASH_HANDOVER_MODEL_NAME,
  type RiderCashHandoverDocument,
} from "./delivery.schema.js";

function assignmentModel(): Model<DeliveryAssignmentDocument> {
  return models({}).get<DeliveryAssignmentDocument>(DELIVERY_ASSIGNMENT_MODEL_NAME);
}

function handoverModel(): Model<RiderCashHandoverDocument> {
  return models({}).get<RiderCashHandoverDocument>(RIDER_CASH_HANDOVER_MODEL_NAME);
}

function toDeliveryAssignment(doc: DeliveryAssignmentDocument): DeliveryAssignment {
  return new DeliveryAssignment({
    deliveryAssignmentId: asId<DeliveryAssignmentId>(doc.deliveryAssignmentId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    locationId: asId<LocationId>(doc.locationId),
    orderId: asId<OrderId>(doc.orderId),
    riderMemberId: doc.riderMemberId,
    attemptOrdinal: doc.attemptOrdinal,
    status: doc.status,
    notes: doc.notes,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: asId<UserId>(doc.createdByUserId ?? ""),
    updatedByUserId: asId<UserId>(doc.updatedByUserId ?? ""),
  });
}

function toRiderCashHandover(doc: RiderCashHandoverDocument): RiderCashHandover {
  return new RiderCashHandover({
    riderCashHandoverId: asId<RiderCashHandoverId>(doc.riderCashHandoverId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    locationId: asId<LocationId>(doc.locationId),
    riderMemberId: doc.riderMemberId,
    receivedByMemberId: doc.receivedByMemberId,
    paymentIds: doc.paymentIds,
    amount: doc.amount,
    receivedVia: doc.receivedVia,
    posSessionId: doc.posSessionId,
    businessDate: doc.businessDate,
    reversesRiderCashHandoverId:
      doc.reversesRiderCashHandoverId === null
        ? null
        : asId<RiderCashHandoverId>(doc.reversesRiderCashHandoverId),
    reversalReason: doc.reversalReason,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: asId<UserId>(doc.createdByUserId ?? ""),
    updatedByUserId: asId<UserId>(doc.updatedByUserId ?? ""),
  });
}

export class MongoDeliveryAssignmentRepository implements DeliveryAssignmentRepository {
  async insert(assignment: DeliveryAssignment): Promise<DeliveryAssignment> {
    const session = getActiveSession();
    const doc: DeliveryAssignmentDocument = {
      deliveryAssignmentId: assignment.deliveryAssignmentId,
      organizationId: assignment.organizationId,
      locationId: assignment.locationId,
      orderId: assignment.orderId,
      riderMemberId: assignment.riderMemberId,
      attemptOrdinal: assignment.attemptOrdinal,
      status: assignment.status,
      notes: assignment.notes,
      version: assignment.version,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      createdByUserId: assignment.createdByUserId,
      updatedByUserId: assignment.updatedByUserId,
    };

    await assignmentModel().create([doc], sessionOption(session));
    return assignment;
  }

  async findById(
    organizationId: OrganizationId,
    assignmentId: DeliveryAssignmentId,
  ): Promise<DeliveryAssignment | undefined> {
    const doc = await assignmentModel()
      .findOne({ organizationId, deliveryAssignmentId: assignmentId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<DeliveryAssignmentDocument>();
    return doc === null ? undefined : toDeliveryAssignment(doc);
  }

  async countByOrder(organizationId: OrganizationId, orderId: OrderId): Promise<number> {
    return assignmentModel().countDocuments(
      { organizationId, orderId },
      sessionOption(getActiveSession()),
    );
  }

  async list(filters: DeliveryAssignmentFilters): Promise<DeliveryAssignmentPage> {
    const query: Record<string, unknown> = { organizationId: filters.organizationId };
    if (filters.orderId !== undefined) query["orderId"] = filters.orderId;
    if (filters.riderMemberId !== undefined) query["riderMemberId"] = filters.riderMemberId;
    if (filters.locationId !== undefined) query["locationId"] = filters.locationId;
    if (filters.status !== undefined) query["status"] = filters.status;

    const skip = (filters.page - 1) * filters.limit;
    const session = getActiveSession();

    const [docs, total] = await Promise.all([
      assignmentModel()
        .find(query, { _id: 0 }, sessionOption(session))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean<DeliveryAssignmentDocument[]>(),
      assignmentModel().countDocuments(query, sessionOption(session)),
    ]);

    return {
      items: docs.map(toDeliveryAssignment),
      total,
      hasNext: skip + docs.length < total,
    };
  }

  async update(assignment: DeliveryAssignment, expectedVersion: number): Promise<DeliveryAssignment> {
    const updated = await updateVersioned({
      model: assignmentModel(),
      filter: {
        organizationId: assignment.organizationId,
        deliveryAssignmentId: assignment.deliveryAssignmentId,
      },
      update: {
        status: assignment.status,
        notes: assignment.notes,
        updatedAt: assignment.updatedAt,
        updatedByUserId: assignment.updatedByUserId,
      },
      expectedVersion,
    });

    return toDeliveryAssignment(updated as unknown as DeliveryAssignmentDocument);
  }
}

export class MongoRiderCashHandoverRepository implements RiderCashHandoverRepository {
  async insert(handover: RiderCashHandover): Promise<RiderCashHandover> {
    const session = getActiveSession();
    const doc: RiderCashHandoverDocument = {
      riderCashHandoverId: handover.riderCashHandoverId,
      organizationId: handover.organizationId,
      locationId: handover.locationId,
      riderMemberId: handover.riderMemberId,
      receivedByMemberId: handover.receivedByMemberId,
      paymentIds: handover.paymentIds,
      amount: handover.amount,
      receivedVia: handover.receivedVia,
      posSessionId: handover.posSessionId,
      businessDate: handover.businessDate,
      reversesRiderCashHandoverId: handover.reversesRiderCashHandoverId,
      reversalReason: handover.reversalReason,
      version: handover.version,
      createdAt: handover.createdAt,
      updatedAt: handover.updatedAt,
      createdByUserId: handover.createdByUserId,
      updatedByUserId: handover.updatedByUserId,
    };

    await handoverModel().create([doc], sessionOption(session));
    return handover;
  }

  async findById(
    organizationId: OrganizationId,
    handoverId: RiderCashHandoverId,
  ): Promise<RiderCashHandover | undefined> {
    const doc = await handoverModel()
      .findOne({ organizationId, riderCashHandoverId: handoverId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<RiderCashHandoverDocument>();
    return doc === null ? undefined : toRiderCashHandover(doc);
  }

  async findByReversalId(
    organizationId: OrganizationId,
    originalHandoverId: RiderCashHandoverId,
  ): Promise<RiderCashHandover | undefined> {
    const doc = await handoverModel()
      .findOne(
        { organizationId, reversesRiderCashHandoverId: originalHandoverId },
        { _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<RiderCashHandoverDocument>();
    return doc === null ? undefined : toRiderCashHandover(doc);
  }
}
