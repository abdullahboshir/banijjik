import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  Checkout,
  CheckoutAccess,
  CheckoutAccessOwner,
  CheckoutQuote,
  CheckoutRequestLinkRecord,
} from "../domain/checkout-types.js";
import type {
  CheckoutAccessRepositoryPort,
  CheckoutQuoteRepositoryPort,
  CheckoutRepositoryPort,
  CheckoutRequestLinkRepositoryPort,
} from "../application/checkout-ports.js";
import {
  CHECKOUT_ACCESS_MODEL_NAME,
  type CheckoutAccessDocument,
} from "./checkout-access.schema.js";
import { CHECKOUT_QUOTE_MODEL_NAME, type CheckoutQuoteDocument } from "./checkout-quote.schema.js";
import {
  CHECKOUT_MODEL_NAME,
  CHECKOUT_REQUEST_LINK_MODEL_NAME,
  type CheckoutDocument,
  type CheckoutRequestLinkDocument,
} from "./checkout.schema.js";
import {
  toCheckout,
  toCheckoutAccess,
  toCheckoutRequestLink,
  toQuote,
} from "./checkout-mappers.js";

export class MongoCheckoutQuoteRepository implements CheckoutQuoteRepositoryPort {
  private model() {
    return models({}).get<CheckoutQuoteDocument>(CHECKOUT_QUOTE_MODEL_NAME);
  }

  async save(quote: CheckoutQuote): Promise<void> {
    await this.model().create(
      [
        {
          quoteId: quote.quoteId,
          organizationId: quote.organizationId,
          principalKey: quote.principalKey,
          input: quote.input,
          inputHash: quote.inputHash,
          pricedSnapshot: quote.pricedSnapshot,
          configVersion: quote.configVersion,
          expiresAt: quote.expiresAt,
          consumedAt: quote.consumedAt,
          consumedCheckoutId: quote.consumedCheckoutId,
          version: quote.version,
        },
      ],
      { ...sessionOption(getActiveSession()), ordered: true },
    );
  }

  async findById(organizationId: string, quoteId: string): Promise<CheckoutQuote | null> {
    const doc = await this.model()
      .findOne({ organizationId, quoteId }, null, sessionOption(getActiveSession()))
      .lean<CheckoutQuoteDocument>();
    return doc ? toQuote(doc) : null;
  }

  async markConsumed(input: {
    readonly organizationId: string;
    readonly quoteId: string;
    readonly checkoutId: string;
    readonly now: Date;
  }): Promise<boolean> {
    const res = await this.model().updateOne(
      { organizationId: input.organizationId, quoteId: input.quoteId, consumedAt: null },
      {
        $set: {
          consumedAt: input.now,
          consumedCheckoutId: input.checkoutId,
        },
        $inc: { version: 1 },
      },
      sessionOption(getActiveSession()),
    );
    return res.modifiedCount === 1;
  }
}

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

  async listByOwner(
    organizationId: string,
    ownerType: "CUSTOMER" | "GUEST",
    identifier: string,
  ): Promise<readonly CheckoutAccess[]> {
    const docs = await this.model()
      .find(
        {
          organizationId,
          "owner.type": ownerType,
          "owner.identifier": identifier,
          revokedAt: null,
        },
        null,
        sessionOption(getActiveSession()),
      )
      .sort({ createdAt: -1 })
      .lean<CheckoutAccessDocument[]>();
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
    return res.modifiedCount === 1;
  }
}

export class MongoCheckoutRequestLinkRepository implements CheckoutRequestLinkRepositoryPort {
  private model() {
    return models({}).get<CheckoutRequestLinkDocument>(CHECKOUT_REQUEST_LINK_MODEL_NAME);
  }

  async saveMany(links: readonly CheckoutRequestLinkRecord[]): Promise<void> {
    if (links.length === 0) return;
    await this.model().create(
      links.map((link) => ({
        checkoutRequestLinkId: link.checkoutRequestLinkId,
        organizationId: link.organizationId,
        checkoutId: link.checkoutId,
        selectionIds: link.selectionIds,
        requestType: link.requestType,
        requestId: link.requestId,
        publicNumber: link.publicNumber,
        status: link.status,
        paymentRequired: link.paymentRequired,
        holdExpiresAt: link.holdExpiresAt,
      })),
      { ...sessionOption(getActiveSession()), ordered: true },
    );
  }

  async listByCheckoutId(
    organizationId: string,
    checkoutId: string,
  ): Promise<readonly CheckoutRequestLinkRecord[]> {
    const docs = await this.model()
      .find({ organizationId, checkoutId }, null, sessionOption(getActiveSession()))
      .sort({ createdAt: 1 })
      .lean<CheckoutRequestLinkDocument[]>();
    return docs.map(toCheckoutRequestLink);
  }

  async findByRequest(
    organizationId: string,
    requestType: "ORDER" | "BOOKING" | "ENROLLMENT",
    requestId: string,
  ): Promise<CheckoutRequestLinkRecord | null> {
    const doc = await this.model()
      .findOne({ organizationId, requestType, requestId }, null, sessionOption(getActiveSession()))
      .lean<CheckoutRequestLinkDocument>();
    return doc ? toCheckoutRequestLink(doc) : null;
  }
}
