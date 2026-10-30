import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import {
  CONTACT_EVENT_TYPE,
  type CreateProvisionalContactInput,
  type ProvisionalContactResult,
} from "@banijjik/contracts/contact";
import { asId, type ContactId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { AppError } from "../../../../../kernel/http/app-error.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { buildProvisionalContact } from "../../domain/provisional-contact.js";
import type { ContactRepository } from "../ports/contact-repository.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type {
  GuestSessionProvisionalLinkPort,
  GuestSessionRecord,
  ProvisionalGuestContactCreator,
} from "../ports/guest-contact-ports.js";
import type { UnitOfWork } from "../ports/unit-of-work.js";

export interface CreateProvisionalGuestContactDependencies {
  readonly contacts: ContactRepository;
  readonly guestSessions: GuestSessionProvisionalLinkPort;
  readonly unitOfWork: UnitOfWork;
  readonly events: EventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

/**
 * Creates or reuses a provisional guest contact inside checkout UnitOfWork.
 * Enforces guest session validity, cross-org isolation, absolute expiry,
 * and maintains the null-phone invariant on the Contact entity.
 */
export class CreateProvisionalGuestContactUseCase implements ProvisionalGuestContactCreator {
  constructor(private readonly dependencies: CreateProvisionalGuestContactDependencies) {}

  createProvisionalContact(
    input: CreateProvisionalContactInput,
  ): Promise<ProvisionalContactResult> {
    return this.execute(input);
  }

  async execute(input: CreateProvisionalContactInput): Promise<ProvisionalContactResult> {
    return this.dependencies.unitOfWork.run(async () => {
      const session = await this.validateSession(input);
      const existing = await this.tryReuseProvisionalContact(session, input);
      if (existing) return existing;
      return this.createAndLinkProvisionalContact(session, input);
    });
  }

  private async validateSession(input: CreateProvisionalContactInput): Promise<GuestSessionRecord> {
    const session = await this.dependencies.guestSessions.findSession(input.guestSessionId);
    if (!session) {
      throw new AppError({ code: ERROR_CODE.UNAUTHENTICATED });
    }
    if (session.organizationId !== input.organizationId) {
      throw new AppError({ code: ERROR_CODE.FORBIDDEN });
    }
    if (this.dependencies.clock.now().getTime() >= session.expiresAt.getTime()) {
      throw new AppError({ code: ERROR_CODE.UNAUTHENTICATED });
    }
    return session;
  }

  private async tryReuseProvisionalContact(
    session: GuestSessionRecord,
    input: CreateProvisionalContactInput,
  ): Promise<ProvisionalContactResult | null> {
    if (session.provisionalContactId === null) return null;
    const existing = await this.dependencies.contacts.findById(
      asId<ContactId>(session.provisionalContactId),
    );
    if (!existing) return null;
    return {
      contactId: session.provisionalContactId,
      contactSnapshot: Object.freeze({
        name: input.name.trim(),
        phoneE164: input.phoneE164,
        customFields: Object.freeze({ ...(input.customFields ?? {}) }),
      }),
    };
  }

  private async createAndLinkProvisionalContact(
    session: GuestSessionRecord,
    input: CreateProvisionalContactInput,
  ): Promise<ProvisionalContactResult> {
    const { contacts, guestSessions, audit, events, clock } = this.dependencies;
    const { contact, contactSnapshot } = buildProvisionalContact(input, clock.now());
    await contacts.insert(contact);

    const linked = await guestSessions.linkProvisionalContact({
      organizationId: input.organizationId,
      guestSessionId: input.guestSessionId,
      provisionalContactId: contact.contactId,
      expectedVersion: session.version,
    });
    if (!linked) {
      throw new AppError({ code: ERROR_CODE.CONFLICT });
    }

    await audit.record({
      action: AUDIT_ACTION.CONTACT_CREATED,
      entityType: AUDIT_ENTITY_TYPE.contact,
      entityId: contact.contactId,
      changes: {
        guestSessionId: { from: null, to: input.guestSessionId },
      },
    });

    await events.publish(
      CONTACT_EVENT_TYPE.PROVISIONAL_CREATED,
      {
        contactId: contact.contactId,
        guestSessionId: input.guestSessionId,
      },
      { orderingKey: `contact:${contact.contactId}` },
    );

    return {
      contactId: contact.contactId,
      contactSnapshot,
    };
  }
}
