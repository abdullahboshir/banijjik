import {
  asId,
  type CollectionClaimId,
  type OrderId,
  type OrganizationId,
  type PaymentId,
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
import { CollectionClaim } from "../domain/collection-claim.entity.js";
import type { CollectionClaimRepository } from "../application/ports/collection-claim.repository.js";
import {
  COLLECTION_CLAIM_MODEL_NAME,
  type CollectionClaimDocument,
} from "./collection-claim.schema.js";

function getModel(): Model<CollectionClaimDocument> {
  return models({}).get<CollectionClaimDocument>(COLLECTION_CLAIM_MODEL_NAME);
}

function toDomain(doc: CollectionClaimDocument): CollectionClaim {
  return CollectionClaim.create({
    collectionClaimId: asId<CollectionClaimId>(doc.collectionClaimId),
    organizationId: asId<OrganizationId>(doc.organizationId),
    paymentId: asId<PaymentId>(doc.paymentId),
    orderId: asId<OrderId>(doc.orderId),
    carrier: {
      method: doc.carrier.method,
      carrierReference: doc.carrier.carrierReference,
    },
    state: doc.state,
    generation: doc.generation,
    claimedByReference: doc.claimedByReference ?? null,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdByUserId: doc.createdByUserId ? asId<UserId>(doc.createdByUserId) : null,
    updatedByUserId: doc.updatedByUserId ? asId<UserId>(doc.updatedByUserId) : null,
  });
}

export class MongoCollectionClaimRepository implements CollectionClaimRepository {
  async save(claim: CollectionClaim): Promise<CollectionClaim> {
    const session = getActiveSession();
    const props = claim.toProps();
    const doc: CollectionClaimDocument = {
      collectionClaimId: props.collectionClaimId,
      organizationId: props.organizationId,
      paymentId: props.paymentId,
      orderId: props.orderId,
      carrier: {
        method: props.carrier.method,
        carrierReference: props.carrier.carrierReference,
      },
      state: props.state,
      generation: props.generation,
      claimedByReference: props.claimedByReference,
      version: props.version,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      createdByUserId: props.createdByUserId,
      updatedByUserId: props.updatedByUserId,
    };
    try {
      const docs = await getModel().create([doc], sessionOption(session));
      const created = docs[0];
      if (!created) throw new Error("Failed to create collection claim");
      return toDomain(created);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw conflict({ messageKey: "payment.collection_claim_already_exists" });
      }
      throw err;
    }
  }

  async findByPaymentId(
    organizationId: OrganizationId,
    paymentId: PaymentId,
  ): Promise<CollectionClaim | undefined> {
    const session = getActiveSession();
    const doc = await getModel()
      .findOne({ organizationId, paymentId }, null, sessionOption(session))
      .lean<CollectionClaimDocument>();
    return doc ? toDomain(doc) : undefined;
  }

  async findByOrderId(
    organizationId: OrganizationId,
    orderId: OrderId,
  ): Promise<readonly CollectionClaim[]> {
    const session = getActiveSession();
    const docs = await getModel()
      .find({ organizationId, orderId }, null, sessionOption(session))
      .lean<CollectionClaimDocument[]>();
    return docs.map(toDomain);
  }

  async findByIds(
    organizationId: OrganizationId,
    paymentIds: readonly PaymentId[],
  ): Promise<readonly CollectionClaim[]> {
    if (paymentIds.length === 0) return [];
    const session = getActiveSession();
    const docs = await getModel()
      .find({ organizationId, paymentId: { $in: paymentIds } }, null, sessionOption(session))
      .lean<CollectionClaimDocument[]>();
    return docs.map(toDomain);
  }

  async update(claim: CollectionClaim, expectedVersion: number): Promise<CollectionClaim> {
    const session = getActiveSession();
    const props = claim.toProps();
    const updated = await updateVersioned({
      model: getModel(),
      filter: {
        organizationId: props.organizationId,
        collectionClaimId: props.collectionClaimId,
      },
      expectedVersion,
      update: {
        $set: {
          state: props.state,
          generation: props.generation,
          claimedByReference: props.claimedByReference,
          updatedAt: props.updatedAt,
          updatedByUserId: props.updatedByUserId,
        },
      },
      ...(session !== undefined ? { session } : {}),
    });
    return toDomain(updated);
  }
}
