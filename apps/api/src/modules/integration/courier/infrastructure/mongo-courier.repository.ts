import type { ManualCourierKey } from "@banijjik/contracts/courier";
import {
  asId,
  InvalidIdError,
  type ConsignmentId,
  type CourierSettlementId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import type { Model } from "mongoose";
import {
  getActiveSession,
  isDuplicateKeyError,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { conflict } from "../../../../kernel/http/index.js";
import { Consignment } from "../domain/consignment.entity.js";
import type {
  ConsignmentFilters,
  ConsignmentPage,
  ConsignmentRepository,
  CourierSettlementRepository,
} from "../domain/courier-repository.js";
import { CourierSettlement } from "../domain/courier-settlement.entity.js";
import { duplicateTrackingNumber } from "../domain/errors.js";
import {
  CONSIGNMENT_MODEL_NAME,
  type ConsignmentDocument,
  COURIER_SETTLEMENT_MODEL_NAME,
  type CourierSettlementDocument,
} from "./courier.schema.js";

function consignmentModel(): Model<ConsignmentDocument> {
  return models({}).get<ConsignmentDocument>(CONSIGNMENT_MODEL_NAME);
}

function settlementModel(): Model<CourierSettlementDocument> {
  return models({}).get<CourierSettlementDocument>(COURIER_SETTLEMENT_MODEL_NAME);
}

function actorOf(value: string | null): UserId {
  if (value === null) throw new InvalidIdError();
  return asId<UserId>(value);
}

function toConsignment(doc: ConsignmentDocument): Consignment {
  return new Consignment({
    consignmentId: asId<ConsignmentId>(doc.consignmentId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    locationId: asId<LocationId>(doc.locationId),
    orderId: asId<OrderId>(doc.orderId),
    attemptOrdinal: doc.attemptOrdinal,
    courierKey: doc.courierKey,
    trackingNumber: doc.trackingNumber,
    status: doc.status,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: actorOf(doc.createdByUserId),
    updatedByUserId: actorOf(doc.updatedByUserId),
  });
}

function toCourierSettlement(doc: CourierSettlementDocument): CourierSettlement {
  return new CourierSettlement({
    courierSettlementId: asId<CourierSettlementId>(doc.courierSettlementId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    courierKey: doc.courierKey,
    paymentIds: doc.paymentIds,
    grossAmount: doc.grossAmount,
    courierCharges: doc.courierCharges,
    netReceived: doc.netReceived,
    receivedVia: doc.receivedVia,
    externalReference: doc.externalReference,
    businessDate: doc.businessDate,
    reversesCourierSettlementId:
      doc.reversesCourierSettlementId === null
        ? null
        : asId<CourierSettlementId>(doc.reversesCourierSettlementId),
    reversalReason: doc.reversalReason,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: actorOf(doc.createdByUserId),
    updatedByUserId: actorOf(doc.updatedByUserId),
  });
}

export class MongoConsignmentRepository implements ConsignmentRepository {
  async insert(consignment: Consignment): Promise<Consignment> {
    const session = getActiveSession();
    try {
      await consignmentModel().create(
        [
          {
            consignmentId: consignment.consignmentId,
            organizationId: consignment.organizationId,
            locationId: consignment.locationId,
            orderId: consignment.orderId,
            attemptOrdinal: consignment.attemptOrdinal,
            courierKey: consignment.courierKey,
            trackingNumber: consignment.trackingNumber,
            status: consignment.status,
            version: consignment.version,
            createdAt: consignment.createdAt,
            updatedAt: consignment.updatedAt,
            createdByUserId: consignment.createdByUserId,
            updatedByUserId: consignment.updatedByUserId,
          },
        ],
        sessionOption(session),
      );
      return consignment;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw duplicateTrackingNumber(consignment.courierKey, consignment.trackingNumber);
      }
      throw error;
    }
  }

  async findById(
    organizationId: OrganizationId,
    consignmentId: ConsignmentId,
  ): Promise<Consignment | undefined> {
    const doc = await consignmentModel()
      .findOne({ organizationId, consignmentId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<ConsignmentDocument>();
    return doc === null ? undefined : toConsignment(doc);
  }

  async findByTracking(
    organizationId: OrganizationId,
    courierKey: ManualCourierKey,
    trackingNumber: string,
  ): Promise<Consignment | undefined> {
    const doc = await consignmentModel()
      .findOne({ organizationId, courierKey, trackingNumber }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<ConsignmentDocument>();
    return doc === null ? undefined : toConsignment(doc);
  }

  async countByOrder(organizationId: OrganizationId, orderId: OrderId): Promise<number> {
    return consignmentModel().countDocuments(
      { organizationId, orderId },
      sessionOption(getActiveSession()),
    );
  }

  async list(filters: ConsignmentFilters): Promise<ConsignmentPage> {
    const query: Record<string, unknown> = { organizationId: filters.organizationId };
    if (filters.orderId !== undefined) query["orderId"] = filters.orderId;
    if (filters.courierKey !== undefined) query["courierKey"] = filters.courierKey;
    if (filters.locationId !== undefined) query["locationId"] = filters.locationId;

    const session = getActiveSession();
    const skip = (filters.page - 1) * filters.limit;
    const [docs, total] = await Promise.all([
      consignmentModel()
        .find(query, { _id: 0 }, sessionOption(session))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .lean<ConsignmentDocument[]>(),
      consignmentModel().countDocuments(query, sessionOption(session)),
    ]);

    return {
      items: docs.map(toConsignment),
      total,
      hasNext: skip + docs.length < total,
    };
  }

  async update(consignment: Consignment, expectedVersion: number): Promise<Consignment> {
    const updated = await updateVersioned({
      model: consignmentModel(),
      filter: {
        organizationId: consignment.organizationId,
        consignmentId: consignment.consignmentId,
      },
      expectedVersion,
      update: {
        $set: {
          status: consignment.status,
          version: consignment.version,
          updatedAt: consignment.updatedAt,
          updatedByUserId: consignment.updatedByUserId,
        },
      },
    });
    return toConsignment(updated);
  }
}

export class MongoCourierSettlementRepository implements CourierSettlementRepository {
  async insert(settlement: CourierSettlement): Promise<CourierSettlement> {
    const session = getActiveSession();
    try {
      await settlementModel().create(
        [
          {
            courierSettlementId: settlement.courierSettlementId,
            organizationId: settlement.organizationId,
            courierKey: settlement.courierKey,
            paymentIds: settlement.paymentIds,
            grossAmount: settlement.grossAmount,
            courierCharges: settlement.courierCharges,
            netReceived: settlement.netReceived,
            receivedVia: settlement.receivedVia,
            externalReference: settlement.externalReference,
            businessDate: settlement.businessDate,
            reversesCourierSettlementId: settlement.reversesCourierSettlementId,
            reversalReason: settlement.reversalReason,
            version: settlement.version,
            createdAt: settlement.createdAt,
            updatedAt: settlement.updatedAt,
            createdByUserId: settlement.createdByUserId,
            updatedByUserId: settlement.updatedByUserId,
          },
        ],
        sessionOption(session),
      );
      return settlement;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw conflict({
          reason: "settlement_duplicate",
          courierKey: settlement.courierKey,
          externalReference: settlement.externalReference,
        });
      }
      throw error;
    }
  }

  async findById(
    organizationId: OrganizationId,
    settlementId: CourierSettlementId,
  ): Promise<CourierSettlement | undefined> {
    const doc = await settlementModel()
      .findOne({ organizationId, courierSettlementId: settlementId }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<CourierSettlementDocument>();
    return doc === null ? undefined : toCourierSettlement(doc);
  }

  async findByExternalReference(
    organizationId: OrganizationId,
    courierKey: ManualCourierKey,
    externalReference: string,
  ): Promise<CourierSettlement | undefined> {
    const doc = await settlementModel()
      .findOne({ organizationId, courierKey, externalReference }, { _id: 0 }, sessionOption(getActiveSession()))
      .lean<CourierSettlementDocument>();
    return doc === null ? undefined : toCourierSettlement(doc);
  }

  async findByReversalId(
    organizationId: OrganizationId,
    originalSettlementId: CourierSettlementId,
  ): Promise<CourierSettlement | undefined> {
    const doc = await settlementModel()
      .findOne(
        { organizationId, reversesCourierSettlementId: originalSettlementId },
        { _id: 0 },
        sessionOption(getActiveSession()),
      )
      .lean<CourierSettlementDocument>();
    return doc === null ? undefined : toCourierSettlement(doc);
  }
}
