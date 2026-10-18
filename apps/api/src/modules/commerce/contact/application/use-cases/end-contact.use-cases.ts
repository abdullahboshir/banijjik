import type { ContactId } from "@banijjik/ids";
import { contactNotFound } from "../../domain/errors.js";
import type { ContactWriteDependencies } from "../contact-dependencies.js";
import { recordContactEnded } from "../contact-records.js";
import { endCustomerLogin } from "../end-customer-login.js";
import type { ContactDetailView } from "../contact-view.js";
import { viewContact } from "../contact-view.js";
import type { ContactActorInput } from "./contact-actor-input.js";

export interface ArchiveContactInput extends ContactActorInput {
  readonly contactId: ContactId;
  readonly version: number;
}

export interface AnonymizeContactInput extends ArchiveContactInput {
  readonly reason: string;
}

/** An archived contact frees its phone for a new contact; it stays readable and in ledgers. */
export class ArchiveContactUseCase {
  constructor(private readonly dependencies: ContactWriteDependencies) {}

  async execute(input: ArchiveContactInput): Promise<ContactDetailView> {
    const { contacts, unitOfWork, customFields } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await contacts.findById(input.contactId);
      if (existing === undefined) throw contactNotFound();
      const updated = await contacts.update(existing.archive(), input.version, input.actorUserId);
      await endCustomerLogin(this.dependencies, existing.contactId);
      await recordContactEnded(this.dependencies, {
        before: existing,
        after: updated,
        isAnonymized: false,
      });
      return updated;
    });
    const fields = await customFields.forContacts(input.organizationId);
    return viewContact(this.dependencies, saved, fields);
  }
}

/** Erasure on request: personal data is cleared, the id stays for ledgers, and it cannot be undone. */
export class AnonymizeContactUseCase {
  constructor(private readonly dependencies: ContactWriteDependencies) {}

  async execute(input: AnonymizeContactInput): Promise<ContactDetailView> {
    const { contacts, unitOfWork, customFields, clock } = this.dependencies;
    const saved = await unitOfWork.run(async () => {
      const existing = await contacts.findById(input.contactId);
      if (existing === undefined) throw contactNotFound();
      const anonymous = existing.anonymize(clock.now());
      const updated = await contacts.update(anonymous, input.version, input.actorUserId);
      await endCustomerLogin(this.dependencies, existing.contactId);
      await recordContactEnded(this.dependencies, {
        before: existing,
        after: updated,
        isAnonymized: true,
        reason: input.reason,
      });
      return updated;
    });
    const fields = await customFields.forContacts(input.organizationId);
    return viewContact(this.dependencies, saved, fields);
  }
}
