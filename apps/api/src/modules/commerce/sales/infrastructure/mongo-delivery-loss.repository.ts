import type { CurrencyCode } from "@banijjik/contracts";
import {
  asId,
  type DeliveryLossClosureId,
  type DeliveryLossRecoveryId,
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
import type { DeliveryLossRepository } from "../application/ports/delivery-loss.repository.js";
import {
  DeliveryLossClosure,
  DeliveryLossRecovery,
} from "../domain/delivery-loss.entity.js";
import {
  DELIVERY_LOSS_CLOSURE_MODEL_NAME,
  DELIVERY_LOSS_RECOVERY_MODEL_NAME,
  type DeliveryLossClosureDocument,
  type DeliveryLossRecoveryDocument,
} from "./delivery-loss.schema.js";

function closureModel(): Model<DeliveryLossClosureDocument> {
  return models({}).get<DeliveryLossClosureDocument>(DELIVERY_LOSS_CLOSURE_MODEL_NAME);
}

function recoveryModel(): Model<DeliveryLossRecoveryDocument> {
  return models({}).get<DeliveryLossRecoveryDocument>(DELIVERY_LOSS_RECOVERY_MODEL_NAME);
}

function toClosure(doc: DeliveryLossClosureDocument): DeliveryLossClosure {
  return new DeliveryLossClosure({
    deliveryLossClosureId: asId<DeliveryLossClosureId>(doc.deliveryLossClosureId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    orderId: asId<OrderId>(doc.orderId),
    locationId: doc.locationId,
    firstShipmentEventId: doc.firstShipmentEventId,
    reasonKey: doc.reasonKey,
    evidenceFileIds: doc.evidenceFileIds,
    lines: doc.lines.map((l) => ({
      orderLineId: l.orderLineId,
      offeringId: l.offeringId,
      variantId: l.variantId,
      inventoryItemId: l.inventoryItemId,
      shippedQuantity: l.shippedQuantity,
      restockQuantity: l.restockQuantity,
      damagedQuantity: l.damagedQuantity,
      lostQuantity: l.lostQuantity,
      recoveredQuantity: l.recoveredQuantity,
      lostCostAmount: l.lostCostAmount,
      costCurrency: l.costCurrency,
    })),
    totalLostCost: {
      amount: doc.totalLostCostAmount,
      currency: doc.totalLostCostCurrency as CurrencyCode,
    },
    approvalToken: doc.approvalToken,
    approvalSnapshot: {
      approverMemberId: doc.approvalApproverMemberId,
      action: doc.approvalAction,
    },
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: asId<UserId>(doc.createdByUserId),
    updatedByUserId: asId<UserId>(doc.updatedByUserId),
  });
}

function toRecovery(doc: DeliveryLossRecoveryDocument): DeliveryLossRecovery {
  return new DeliveryLossRecovery({
    deliveryLossRecoveryId: asId<DeliveryLossRecoveryId>(doc.deliveryLossRecoveryId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    deliveryLossClosureId: asId<DeliveryLossClosureId>(doc.deliveryLossClosureId),
    orderId: asId<OrderId>(doc.orderId),
    locationId: doc.locationId,
    lines: doc.lines.map((l) => ({
      orderLineId: l.orderLineId,
      offeringId: l.offeringId,
      variantId: l.variantId,
      inventoryItemId: l.inventoryItemId,
      restockQuantity: l.restockQuantity,
      damagedQuantity: l.damagedQuantity,
      recoveredCostAmount: l.recoveredCostAmount,
      costCurrency: l.costCurrency,
    })),
    totalRecoveredCost: {
      amount: doc.totalRecoveredCostAmount,
      currency: doc.totalRecoveredCostCurrency as CurrencyCode,
    },
    approvalToken: doc.approvalToken,
    approvalSnapshot: {
      approverMemberId: doc.approvalApproverMemberId,
      action: doc.approvalAction,
    },
    createdAt: doc.createdAt,
    createdByUserId: asId<UserId>(doc.createdByUserId),
  });
}

export class MongoDeliveryLossRepository implements DeliveryLossRepository {
  async createClosure(closure: DeliveryLossClosure): Promise<DeliveryLossClosure> {
    const session = getActiveSession();
    try {
      const docs = await closureModel().create(
        [
          {
            deliveryLossClosureId: closure.deliveryLossClosureId,
            organizationId: closure.organizationId,
            orderId: closure.orderId,
            locationId: closure.locationId,
            firstShipmentEventId: closure.firstShipmentEventId,
            reasonKey: closure.reasonKey,
            evidenceFileIds: [...closure.evidenceFileIds],
            lines: closure.lines.map((l) => ({ ...l })),
            totalLostCostAmount: closure.totalLostCost.amount,
            totalLostCostCurrency: closure.totalLostCost.currency,
            approvalToken: closure.approvalToken,
            approvalApproverMemberId: closure.approvalSnapshot.approverMemberId,
            approvalAction: closure.approvalSnapshot.action,
            version: closure.version,
            createdAt: closure.createdAt,
            updatedAt: closure.updatedAt,
            createdByUserId: closure.createdByUserId,
            updatedByUserId: closure.updatedByUserId,
          },
        ],
        sessionOption(session),
      );
      const created = docs[0];
      if (!created) throw new Error("Failed to create delivery loss closure");
      return toClosure(created);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw conflict({ messageKey: "sales.delivery_loss_closure_already_exists" });
      }
      throw err;
    }
  }

  async updateClosure(
    closure: DeliveryLossClosure,
    expectedVersion: number,
  ): Promise<DeliveryLossClosure> {
    const session = getActiveSession();
    const updated = await updateVersioned({
      model: closureModel(),
      filter: {
        organizationId: closure.organizationId,
        deliveryLossClosureId: closure.deliveryLossClosureId,
      },
      expectedVersion,
      update: {
        $set: {
          lines: closure.lines.map((l) => ({ ...l })),
          updatedAt: closure.updatedAt,
          updatedByUserId: closure.updatedByUserId,
        },
      },
      ...(session !== undefined ? { session } : {}),
    });
    return toClosure(updated);
  }

  async findClosureByOrderId(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<DeliveryLossClosure | null> {
    const doc = await closureModel()
      .findOne({ organizationId, orderId }, {}, sessionOption(getActiveSession()))
      .lean<DeliveryLossClosureDocument | null>();
    return doc ? toClosure(doc) : null;
  }

  async findClosureById(
    organizationId: OrganizationId,
    deliveryLossClosureId: DeliveryLossClosureId,
  ): Promise<DeliveryLossClosure | null> {
    const doc = await closureModel()
      .findOne({ organizationId, deliveryLossClosureId }, {}, sessionOption(getActiveSession()))
      .lean<DeliveryLossClosureDocument | null>();
    return doc ? toClosure(doc) : null;
  }

  async createRecovery(recovery: DeliveryLossRecovery): Promise<DeliveryLossRecovery> {
    const session = getActiveSession();
    const docs = await recoveryModel().create(
      [
        {
          deliveryLossRecoveryId: recovery.deliveryLossRecoveryId,
          organizationId: recovery.organizationId,
          deliveryLossClosureId: recovery.deliveryLossClosureId,
          orderId: recovery.orderId,
          locationId: recovery.locationId,
          lines: recovery.lines.map((l) => ({ ...l })),
          totalRecoveredCostAmount: recovery.totalRecoveredCost.amount,
          totalRecoveredCostCurrency: recovery.totalRecoveredCost.currency,
          approvalToken: recovery.approvalToken,
          approvalApproverMemberId: recovery.approvalSnapshot.approverMemberId,
          approvalAction: recovery.approvalSnapshot.action,
          createdAt: recovery.createdAt,
          createdByUserId: recovery.createdByUserId,
        },
      ],
      sessionOption(session),
    );
    const created = docs[0];
    if (!created) throw new Error("Failed to create delivery loss recovery");
    return toRecovery(created);
  }

  async listRecoveries(
    organizationId: OrganizationId,
    deliveryLossClosureId: DeliveryLossClosureId,
  ): Promise<readonly DeliveryLossRecovery[]> {
    const docs = await recoveryModel()
      .find(
        { organizationId, deliveryLossClosureId },
        {},
        { sort: { createdAt: 1 }, ...sessionOption(getActiveSession()) },
      )
      .lean<DeliveryLossRecoveryDocument[]>();
    return docs.map((d) => toRecovery(d));
  }
}
