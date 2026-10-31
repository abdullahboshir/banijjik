import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { CheckoutQuote, CheckoutQuoteInputSnapshot } from "../domain/checkout-types.js";
import type { CheckoutQuoteRepositoryPort } from "../application/checkout-ports.js";
import { CHECKOUT_QUOTE_MODEL_NAME, type CheckoutQuoteDocument } from "./checkout-quote.schema.js";
import { toQuote } from "./checkout-mappers.js";

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

  async scrubPrincipalQuotes(organizationId: string, principalKey: string): Promise<void> {
    const quotes = await this.model()
      .find({ organizationId, principalKey }, null, sessionOption(getActiveSession()))
      .lean<CheckoutQuoteDocument[]>();
    await this.scrubQuotes(organizationId, quotes);
  }

  async scrubQuotesByIds(organizationId: string, quoteIds: readonly string[]): Promise<void> {
    if (quoteIds.length === 0) return;
    const quotes = await this.model()
      .find(
        { organizationId, quoteId: { $in: [...quoteIds] } },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<CheckoutQuoteDocument[]>();
    await this.scrubQuotes(organizationId, quotes);
  }

  private async scrubQuotes(
    organizationId: string,
    quotes: readonly CheckoutQuoteDocument[],
  ): Promise<void> {
    for (const quote of quotes) {
      const redacted = redactQuoteInput(quote.input);
      if (!redacted) continue;
      await this.model().updateOne(
        { organizationId, quoteId: quote.quoteId },
        {
          $set: { input: redacted },
          $inc: { version: 1 },
        },
        sessionOption(getActiveSession()),
      );
    }
  }
}

/**
 * Returns the redacted snapshot, or `null` when the quote carries no scrubable PII.
 * Shared by both erasure lookups so a claimed checkout (quote still keyed to the guest
 * session) is scrubbed exactly like a checkout the customer created directly.
 */
function redactQuoteInput(input: CheckoutQuoteInputSnapshot): CheckoutQuoteInputSnapshot | null {
  let redacted = input;
  if (input.fulfillment.address) {
    const address = input.fulfillment.address;
    redacted = {
      ...redacted,
      fulfillment: {
        ...input.fulfillment,
        address: {
          ...address,
          recipientName: "[REDACTED]",
          phone: "[REDACTED]",
          addressLine: "[REDACTED]",
        },
      },
    };
  }
  const hasCustomFields = input.selections.some(
    (selection) => Object.keys(selection.customFields ?? {}).length > 0,
  );
  if (hasCustomFields) {
    redacted = {
      ...redacted,
      selections: redacted.selections.map((selection) => ({ ...selection, customFields: {} })),
    };
  }
  return redacted === input ? null : redacted;
}
