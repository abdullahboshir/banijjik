import { newId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { CustomerSmsSentRepository } from "../application/ports/customer-account-ports.js";
import {
  CUSTOMER_SMS_SENT_MODEL_NAME,
  type CustomerSmsSentDocument,
} from "./customer-account.schema.js";

/**
 * The upsert reports whether the record is new, so a duplicate learns it is a repeat without a
 * failing insert (a failed write would abort the surrounding transaction).
 */
export class MongoCustomerSmsSentRepository implements CustomerSmsSentRepository {
  async claim(input: { readonly dedupeKey: string; readonly now: Date }): Promise<boolean> {
    const result = await models({})
      .get<CustomerSmsSentDocument>(CUSTOMER_SMS_SENT_MODEL_NAME)
      .updateOne(
        { dedupeKey: input.dedupeKey },
        {
          $setOnInsert: {
            customerSmsSentId: newId(),
            dedupeKey: input.dedupeKey,
            sentAt: input.now,
          },
        },
        { upsert: true, ...sessionOption(getActiveSession()) },
      );
    return result.upsertedCount > 0;
  }
}
