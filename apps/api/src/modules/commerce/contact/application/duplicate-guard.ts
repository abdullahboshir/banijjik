import { CONTACT_DEDUPE_MODE } from "@banijjik/contracts/contact";
import type { ContactId, OrganizationId } from "@banijjik/ids";
import { ContactPhoneTakenError, contactDuplicate } from "../domain/errors.js";
import type { ContactWriteDependencies } from "./contact-dependencies.js";

export interface DuplicateCheck {
  readonly organizationId: OrganizationId;
  readonly phoneE164: string | undefined;
  readonly email: string | undefined;
  /** An edit does not collide with the contact itself. */
  readonly ignoreContactId?: ContactId;
}

/**
 * One party, one contact (09 section 5.1, manoxen rule 11): the phone first, then, when the
 * organization chose `PHONE_OR_EMAIL`, the email. A match with an ACTIVE contact is a 409 that
 * names the existing contact, so the screen can offer "open existing".
 */
export async function assertNotDuplicate(
  dependencies: Pick<ContactWriteDependencies, "contacts" | "dedupeModes">,
  check: DuplicateCheck,
): Promise<void> {
  const { contacts, dedupeModes } = dependencies;
  const byPhone =
    check.phoneE164 === undefined ? undefined : await contacts.findActiveByPhone(check.phoneE164);
  if (byPhone !== undefined && byPhone.contactId !== check.ignoreContactId) {
    throw contactDuplicate(byPhone.contactId);
  }
  if (check.email === undefined) return;
  if ((await dedupeModes.read(check.organizationId)) !== CONTACT_DEDUPE_MODE.PHONE_OR_EMAIL) return;
  const byEmail = await contacts.findActiveByEmail(check.email);
  if (byEmail !== undefined && byEmail.contactId !== check.ignoreContactId) {
    throw contactDuplicate(byEmail.contactId);
  }
}

/**
 * The unique index caught a concurrent create the check above could not see. That aborted the
 * transaction, so the winner is read here, outside it, and the loser gets the same 409.
 */
export async function asDuplicateAnswer(
  dependencies: Pick<ContactWriteDependencies, "contacts">,
  error: unknown,
): Promise<unknown> {
  if (!(error instanceof ContactPhoneTakenError)) return error;
  const winner = await dependencies.contacts.findActiveByPhone(error.phoneE164);
  return winner === undefined ? error : contactDuplicate(winner.contactId);
}
