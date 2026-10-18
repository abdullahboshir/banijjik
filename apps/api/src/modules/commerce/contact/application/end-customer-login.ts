import type { ContactId } from "@banijjik/ids";
import type { ContactWriteDependencies } from "./contact-dependencies.js";

/**
 * An archived or anonymized contact ends its website login: the account and its sessions are deleted
 * in the same transaction. The account holds the phone number, so it must go with the personal data
 * (erasure), and it frees the phone for a new contact (ADR-119). Call inside the unit of work.
 */
export async function endCustomerLogin(
  dependencies: Pick<ContactWriteDependencies, "customerAccounts" | "customerSessions">,
  contactId: ContactId,
): Promise<void> {
  const { customerAccounts, customerSessions } = dependencies;
  const customerAccountId = await customerAccounts.deleteByContactId(contactId);
  if (customerAccountId === undefined) return;
  await customerSessions.deleteAllOfAccount(customerAccountId);
}
