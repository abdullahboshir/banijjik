import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { CONTACT_EVENT_TYPE } from "@banijjik/contracts/contact";
import type { ContactId } from "@banijjik/ids";
import type { ContactWriteDependencies } from "./contact-dependencies.js";

/**
 * An archived or anonymized contact ends its website login: the account and its sessions are deleted
 * in the same transaction. The account holds the phone number, so it must go with the personal data
 * (erasure), and it frees the phone for a new contact (ADR-119). Call inside the unit of work.
 */
export async function endCustomerLogin(
  dependencies: Pick<
    ContactWriteDependencies,
    "customerAccounts" | "customerSessions" | "audit" | "events"
  >,
  contactId: ContactId,
): Promise<void> {
  const { customerAccounts, customerSessions, audit, events } = dependencies;
  const customerAccountId = await customerAccounts.deleteByContactId(contactId);
  if (customerAccountId === undefined) return;
  await customerSessions.deleteAllOfAccount(customerAccountId);
  await audit.record({
    action: AUDIT_ACTION.CUSTOMER_ACCOUNT_ENDED,
    entityType: AUDIT_ENTITY_TYPE.customerAccount,
    entityId: customerAccountId,
  });
  await events.publish(CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_ENDED, { customerAccountId, contactId });
}
