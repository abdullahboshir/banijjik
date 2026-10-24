import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import {
  STORE_CREDIT_ENTRY_MODEL_NAME,
  type StoreCreditEntryDocument,
} from "./store-credit-entry.schema.js";

/**
 * The store-credit entry a refund payment wrote, for callers that must store its id (a sales
 * return keeps it on the return). Reads inside the caller's transaction.
 */
export async function findStoreCreditEntryIdOfPayment(
  organizationId: OrganizationId,
  paymentId: string,
): Promise<string | null> {
  const Model = models({ organizationId }).get<StoreCreditEntryDocument>(
    STORE_CREDIT_ENTRY_MODEL_NAME,
  );
  const row = await Model.findOne(
    { organizationId, paymentId },
    { _id: 0, storeCreditEntryId: 1 },
    sessionOption(getActiveSession()),
  ).lean<Pick<StoreCreditEntryDocument, "storeCreditEntryId"> | null>();
  return row === null ? null : row.storeCreditEntryId;
}
