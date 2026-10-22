import type { CustomerAccountId, UserId } from "@banijjik/ids";
import { CreditSelfVerifyForbiddenError } from "../../domain/errors.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";

async function matchByPhone(
  deps: Pick<CreditDependencies, "contacts">,
  staffPhone: string,
  accountContactId: string,
): Promise<boolean> {
  const contact = await deps.contacts.findActiveByPhone(staffPhone);
  return contact !== undefined && contact.contactId === accountContactId;
}

async function matchByEmail(
  deps: Pick<CreditDependencies, "contacts">,
  staffEmail: string,
  accountContactId: string,
): Promise<boolean> {
  const contact = await deps.contacts.findActiveByEmail(staffEmail);
  return contact !== undefined && contact.contactId === accountContactId;
}

export async function assertNotSelfService(
  deps: Pick<CreditDependencies, "users" | "accounts" | "contacts">,
  actorUserId: UserId,
  customerAccountId: CustomerAccountId,
): Promise<void> {
  const staff = await deps.users.findIdentifiers(actorUserId);
  if (!staff) return;

  const account = await deps.accounts.findById(customerAccountId);
  if (!account) return;

  if (staff.phoneE164 && account.phoneE164 === staff.phoneE164) {
    throw new CreditSelfVerifyForbiddenError();
  }
  if (staff.phoneE164 && (await matchByPhone(deps, staff.phoneE164, account.contactId))) {
    throw new CreditSelfVerifyForbiddenError();
  }
  if (staff.email && (await matchByEmail(deps, staff.email, account.contactId))) {
    throw new CreditSelfVerifyForbiddenError();
  }
}
