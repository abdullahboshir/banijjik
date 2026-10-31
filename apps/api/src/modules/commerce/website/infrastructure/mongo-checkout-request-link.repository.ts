import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { CheckoutAccessOwner, CheckoutRequestLinkRecord } from "../domain/checkout-types.js";
import type { CheckoutRequestLinkRepositoryPort } from "../application/checkout-ports.js";
import {
  CHECKOUT_REQUEST_LINK_MODEL_NAME,
  type CheckoutRequestLinkDocument,
} from "./checkout.schema.js";
import { toCheckoutRequestLink } from "./checkout-mappers.js";

interface OwnerRequestLinksQuery {
  readonly organizationId: string;
  readonly ownerType: "CUSTOMER" | "GUEST";
  readonly ownerIdentifier: string;
  readonly requestType?: "ORDER" | "BOOKING" | "ENROLLMENT";
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
        ownerType: link.ownerType,
        ownerIdentifier: link.ownerIdentifier,
        revokedAt: link.revokedAt,
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

  async listByCheckoutIds(
    organizationId: string,
    checkoutIds: readonly string[],
  ): Promise<readonly CheckoutRequestLinkRecord[]> {
    if (checkoutIds.length === 0) return [];
    const docs = await this.model()
      .find(
        { organizationId, checkoutId: { $in: checkoutIds } },
        null,
        sessionOption(getActiveSession()),
      )
      .sort({ createdAt: 1 })
      .lean<CheckoutRequestLinkDocument[]>();
    return docs.map(toCheckoutRequestLink);
  }

  async listByOwner(input: {
    readonly organizationId: string;
    readonly ownerType: "CUSTOMER" | "GUEST";
    readonly identifier: string;
    readonly requestType?: "ORDER" | "BOOKING" | "ENROLLMENT";
    readonly page: number;
    readonly limit: number;
  }): Promise<{ readonly links: readonly CheckoutRequestLinkRecord[]; readonly total: number }> {
    const query: OwnerRequestLinksQuery = {
      organizationId: input.organizationId,
      ownerType: input.ownerType,
      ownerIdentifier: input.identifier,
      ...(input.requestType ? { requestType: input.requestType } : {}),
    };
    const filter = { ...query, revokedAt: null };
    const [total, docs] = await Promise.all([
      this.model().countDocuments(filter, sessionOption(getActiveSession())),
      this.model()
        .find(filter, null, sessionOption(getActiveSession()))
        .sort({ createdAt: -1, checkoutRequestLinkId: 1 })
        .skip((input.page - 1) * input.limit)
        .limit(input.limit)
        .lean<CheckoutRequestLinkDocument[]>(),
    ]);
    return { links: docs.map(toCheckoutRequestLink), total };
  }

  async transferOwner(input: {
    readonly organizationId: string;
    readonly checkoutId: string;
    readonly fromOwnerType: "CUSTOMER" | "GUEST";
    readonly fromOwnerIdentifier: string;
    readonly toOwner: CheckoutAccessOwner;
    readonly now: Date;
  }): Promise<number> {
    const res = await this.model().updateMany(
      {
        organizationId: input.organizationId,
        checkoutId: input.checkoutId,
        ownerType: input.fromOwnerType,
        ownerIdentifier: input.fromOwnerIdentifier,
        revokedAt: null,
      },
      {
        $set: {
          ownerType: input.toOwner.type,
          ownerIdentifier: input.toOwner.identifier,
          updatedAt: input.now,
        },
      },
      sessionOption(getActiveSession()),
    );
    return res.matchedCount;
  }

  async revokeByCheckoutIds(
    organizationId: string,
    checkoutIds: readonly string[],
    now: Date,
  ): Promise<number> {
    if (checkoutIds.length === 0) return 0;
    const res = await this.model().updateMany(
      { organizationId, checkoutId: { $in: [...checkoutIds] }, revokedAt: null },
      { $set: { revokedAt: now, updatedAt: now } },
      sessionOption(getActiveSession()),
    );
    return res.matchedCount;
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
