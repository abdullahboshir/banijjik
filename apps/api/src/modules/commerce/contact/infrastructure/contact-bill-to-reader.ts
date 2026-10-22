import { CONTACT_STATUS } from "@banijjik/contracts/contact";
import { asId, isUuidV7, type ContactId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { CONTACT_MODEL_NAME, type ContactDocument } from "./contact.schema.js";

/** Tenant-scoped reads for an enrollment's person and payer; no contact data leaves this port. */
export function buildContactBillToReader(): {
  findActive(contactId: ContactId): Promise<{ contactId: ContactId } | undefined>;
  readLinkValue(contactId: ContactId, fieldKey: string): Promise<ContactId | undefined>;
} {
  const contacts = () => models({}).get<ContactDocument>(CONTACT_MODEL_NAME);
  async function findActive(contactId: ContactId) {
    const row = await contacts()
      .findOne(
        { contactId, status: CONTACT_STATUS.ACTIVE },
        { _id: 0, contactId: 1 },
        sessionOption(getActiveSession()),
      )
      .lean<Pick<ContactDocument, "contactId">>();
    return row === null ? undefined : { contactId: asId<ContactId>(row.contactId) };
  }
  return {
    findActive,
    async readLinkValue(contactId, fieldKey) {
      const row = await contacts()
        .findOne(
          { contactId, status: CONTACT_STATUS.ACTIVE },
          { _id: 0, [`customFields.${fieldKey}`]: 1 },
          sessionOption(getActiveSession()),
        )
        .lean<Pick<ContactDocument, "customFields">>();
      const value = row?.customFields?.[fieldKey];
      if (typeof value !== "string" || !isUuidV7(value)) return undefined;
      return (await findActive(asId<ContactId>(value)))?.contactId;
    },
  };
}
