import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { Checkout, CheckoutAccess, CheckoutAccessOwner } from "../domain/checkout-types.js";
import type {
  CheckoutAccessRepositoryPort,
  CheckoutRepositoryPort,
} from "../application/checkout-ports.js";
import {
  CHECKOUT_ACCESS_MODEL_NAME,
  type CheckoutAccessDocument,
} from "./checkout-access.schema.js";
import { MongoCheckoutRequestLinkRepository } from "./mongo-checkout-request-link.repository.js";
import { CHECKOUT_MODEL_NAME, type CheckoutDocument } from "./checkout.schema.js";
import { toCheckout, toCheckoutAccess } from "./checkout-mappers.js";

export class MongoCheckoutRepository implements CheckoutRepositoryPort {
  private model() {
    return models({}).get<CheckoutDocument>(CHECKOUT_MODEL_NAME);
  }

  async save(checkout: Checkout): Promise<void> {
    await this.model().create(
      [
        {
          checkoutId: checkout.checkoutId,
          organizationId: checkout.organizationId,
          locationId: checkout.locationId,
          creationPrincipalKey: checkout.creationPrincipalKey,
          contactId: checkout.contactId,
          contactSnapshot: checkout.contactSnapshot,
          quoteId: checkout.quoteId,
          acceptedTotals: checkout.acceptedTotals,
          idempotencyKeyHash: checkout.idempotencyKeyHash,
          inputHash: checkout.inputHash,
          version: checkout.version,
        },
      ],
      { ...sessionOption(getActiveSession()), ordered: true },
    );
  }

  async findById(organizationId: string, checkoutId: string): Promise<Checkout | null> {
    const doc = await this.model()
      .findOne({ organizationId, checkoutId }, null, sessionOption(getActiveSession()))
      .lean<CheckoutDocument>();
    return doc ? toCheckout(doc) : null;
  }

  async findByQuoteId(organizationId: string, quoteId: string): Promise<Checkout | null> {
    const doc = await this.model()
      .findOne({ organizationId, quoteId }, null, sessionOption(getActiveSession()))
      .lean<CheckoutDocument>();
    return doc ? toCheckout(doc) : null;
  }

  async findByIdempotencyKey(
    organizationId: string,
    creationPrincipalKey: string,
    idempotencyKeyHash: string,
  ): Promise<Checkout | null> {
    const doc = await this.model()
      .findOne(
        { organizationId, creationPrincipalKey, idempotencyKeyHash },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<CheckoutDocument>();
    return doc ? toCheckout(doc) : null;
  }

  async findByIds(
    organizationId: string,
    checkoutIds: readonly string[],
  ): Promise<readonly Checkout[]> {
    if (checkoutIds.length === 0) return [];
    const docs = await this.model()
      .find(
        { organizationId, checkoutId: { $in: checkoutIds } },
        null,
        sessionOption(getActiveSession()),
      )
      .sort({ createdAt: -1 })
      .lean<CheckoutDocument[]>();
    return docs.map(toCheckout);
  }

  async redactContactSnapshots(
    organizationId: string,
    checkoutIds: readonly string[],
  ): Promise<void> {
    if (checkoutIds.length === 0) return;
    await this.model().updateMany(
      {
        organizationId,
        checkoutId: { $in: checkoutIds },
      },
      {
        $set: {
          contactSnapshot: {
            name: "[REDACTED]",
            phoneE164: "[REDACTED]",
            customFields: {},
          },
        },
        $inc: { version: 1 },
      },
      sessionOption(getActiveSession()),
    );
  }
}

export class MongoCheckoutAccessRepository implements CheckoutAccessRepositoryPort {
  private model() {
    return models({}).get<CheckoutAccessDocument>(CHECKOUT_ACCESS_MODEL_NAME);
  }

  async save(access: CheckoutAccess): Promise<void> {
    await this.model().create(
      [
        {
          checkoutAccessId: access.checkoutAccessId,
          organizationId: access.organizationId,
          checkoutId: access.checkoutId,
          owner: access.owner,
          revokedAt: access.revokedAt,
          version: access.version,
        },
      ],
      { ...sessionOption(getActiveSession()), ordered: true },
    );
  }

  async findByCheckoutId(
    organizationId: string,
    checkoutId: string,
  ): Promise<CheckoutAccess | null> {
    const doc = await this.model()
      .findOne({ organizationId, checkoutId }, null, sessionOption(getActiveSession()))
      .lean<CheckoutAccessDocument>();
    return doc ? toCheckoutAccess(doc) : null;
  }

  async listByOwner(input: {
    readonly organizationId: string;
    readonly ownerType: "CUSTOMER" | "GUEST";
    readonly identifier: string;
    readonly limit?: number;
  }): Promise<readonly CheckoutAccess[]> {
    let query = this.model()
      .find(
        {
          organizationId: input.organizationId,
          "owner.type": input.ownerType,
          "owner.identifier": input.identifier,
          revokedAt: null,
        },
        null,
        sessionOption(getActiveSession()),
      )
      .sort({ createdAt: -1 });

    if (input.limit !== undefined) {
      query = query.limit(input.limit);
    }

    const docs = await query.lean<CheckoutAccessDocument[]>();
    return docs.map(toCheckoutAccess);
  }

  async updateOwner(input: {
    readonly organizationId: string;
    readonly checkoutId: string;
    readonly expectedVersion: number;
    readonly newOwner: CheckoutAccessOwner;
  }): Promise<boolean> {
    const res = await this.model().updateOne(
      {
        organizationId: input.organizationId,
        checkoutId: input.checkoutId,
        version: input.expectedVersion,
      },
      {
        $set: { owner: input.newOwner },
        $inc: { version: 1 },
      },
      sessionOption(getActiveSession()),
    );
    return res.modifiedCount === 1;
  }

  async revoke(organizationId: string, checkoutId: string, now: Date): Promise<boolean> {
    const res = await this.model().updateOne(
      { organizationId, checkoutId, revokedAt: null },
      {
        $set: { revokedAt: now },
        $inc: { version: 1 },
      },
      sessionOption(getActiveSession()),
    );
    if (res.modifiedCount !== 1) return false;
    // Tracking lists page on the link's denormalized owner, so revocation must reach the links
    // too or a revoked session could keep seeing its requests.
    await new MongoCheckoutRequestLinkRepository().revokeByCheckoutIds(
      organizationId,
      [checkoutId],
      now,
    );
    return true;
  }

  async revokeForOwner(input: {
    readonly organizationId: string;
    readonly ownerType: "CUSTOMER" | "GUEST";
    readonly identifier: string;
    readonly now: Date;
  }): Promise<readonly string[]> {
    const docs = await this.model()
      .find(
        {
          organizationId: input.organizationId,
          "owner.type": input.ownerType,
          "owner.identifier": input.identifier,
        },
        { checkoutId: 1, revokedAt: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<CheckoutAccessDocument[]>();

    const allCheckoutIds = docs.map((d) => d.checkoutId);
    const unrevokedCheckoutIds = docs.filter((d) => d.revokedAt === null).map((d) => d.checkoutId);

    if (unrevokedCheckoutIds.length > 0) {
      await this.model().updateMany(
        {
          organizationId: input.organizationId,
          checkoutId: { $in: unrevokedCheckoutIds },
          revokedAt: null,
        },
        {
          $set: { revokedAt: input.now },
          $inc: { version: 1 },
        },
        sessionOption(getActiveSession()),
      );
      // The link list pages on the denormalized owner; without this the erased customer would
      // still see every revoked checkout in /me/requests.
      await new MongoCheckoutRequestLinkRepository().revokeByCheckoutIds(
        input.organizationId,
        unrevokedCheckoutIds,
        input.now,
      );
    }
    return allCheckoutIds;
  }
}
