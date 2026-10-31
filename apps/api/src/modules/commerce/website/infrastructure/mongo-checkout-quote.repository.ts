import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { CheckoutQuote } from "../domain/checkout-types.js";
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
}
