import type { ContactId, OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { ContactStoreCreditPort } from "../application/ports/payment-repositories.js";

const CONTACT_MODEL_NAME = "Contact";

export class MongoContactStoreCreditAdapter implements ContactStoreCreditPort {
  async getBalance(
    organizationId: OrganizationId,
    contactId: ContactId,
  ): Promise<{ balanceMinor: number; version: number } | undefined> {
    const doc = await models({})
      .get<{ summary?: { storeCreditBalanceMinor?: number }; version: number }>(CONTACT_MODEL_NAME)
      .findOne({ organizationId, contactId })
      .select({ "summary.storeCreditBalanceMinor": 1, version: 1 })
      .lean<{ summary?: { storeCreditBalanceMinor?: number }; version: number }>();

    if (!doc) return undefined;
    return {
      balanceMinor: doc.summary?.storeCreditBalanceMinor ?? 0,
      version: doc.version,
    };
  }

  async adjustBalance(input: {
    readonly organizationId: OrganizationId;
    readonly contactId: ContactId;
    readonly deltaMinor: number;
    readonly expectedVersion: number;
  }): Promise<{ success: boolean; newBalanceMinor: number }> {
    const filter: Record<string, unknown> = {
      organizationId: input.organizationId,
      contactId: input.contactId,
      version: input.expectedVersion,
    };
    if (input.deltaMinor < 0) {
      filter["summary.storeCreditBalanceMinor"] = { $gte: -input.deltaMinor };
    }

    const update = {
      $inc: {
        "summary.storeCreditBalanceMinor": input.deltaMinor,
        version: 1,
      },
    };

    const res = await models({})
      .get<{ summary?: { storeCreditBalanceMinor?: number } }>(CONTACT_MODEL_NAME)
      .findOneAndUpdate(filter, update, {
        new: true,
        ...sessionOption(getActiveSession()),
      })
      .select({ "summary.storeCreditBalanceMinor": 1 })
      .lean<{ summary?: { storeCreditBalanceMinor?: number } }>();

    if (!res) {
      return { success: false, newBalanceMinor: 0 };
    }

    return {
      success: true,
      newBalanceMinor: res.summary?.storeCreditBalanceMinor ?? 0,
    };
  }
}
