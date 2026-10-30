import type { AuditRecorder } from "../../../kernel/audit/index.js";
import {
  getActiveSession,
  models,
  MongoUnitOfWork,
  sessionOption,
} from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { ContactRepository } from "./application/ports/contact-repository.js";
import type { EventPublisher } from "./application/ports/event-publisher.js";
import type {
  GuestSessionProvisionalLinkPort,
  GuestSessionRecord,
  LinkProvisionalContactInput,
} from "./application/ports/guest-contact-ports.js";
import type { UnitOfWork } from "./application/ports/unit-of-work.js";
import { CreateProvisionalGuestContactUseCase } from "./application/use-cases/create-provisional-guest-contact.use-case.js";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";

interface GuestSessionDoc {
  readonly guestSessionId: string;
  readonly organizationId: string;
  readonly expiresAt: Date;
  readonly provisionalContactId?: string | null;
  readonly version: number;
}

export function buildMongoGuestSessionProvisionalLinkPort(): GuestSessionProvisionalLinkPort {
  const model = () => models({}).get<GuestSessionDoc>("GuestSession");
  return {
    async findSession(guestSessionId: string): Promise<GuestSessionRecord | null> {
      const doc = await model()
        .findOne({ guestSessionId }, null, sessionOption(getActiveSession()))
        .lean<GuestSessionDoc>();
      if (!doc) return null;
      return {
        guestSessionId: doc.guestSessionId,
        organizationId: doc.organizationId,
        expiresAt: doc.expiresAt,
        provisionalContactId: doc.provisionalContactId ?? null,
        version: doc.version,
      };
    },
    async linkProvisionalContact(input: LinkProvisionalContactInput): Promise<boolean> {
      const res = await model().updateOne(
        {
          guestSessionId: input.guestSessionId,
          organizationId: input.organizationId,
          version: input.expectedVersion,
        },
        {
          $set: { provisionalContactId: input.provisionalContactId },
          $inc: { version: 1 },
        },
        sessionOption(getActiveSession()),
      );
      return res.modifiedCount === 1;
    },
  };
}

export interface ProvisionalGuestContactCreatorOptions {
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly contacts?: ContactRepository;
  readonly guestSessions?: GuestSessionProvisionalLinkPort;
  readonly unitOfWork?: UnitOfWork;
  readonly events?: EventPublisher;
}

export function buildProvisionalGuestContactCreator(
  opts: ProvisionalGuestContactCreatorOptions,
): CreateProvisionalGuestContactUseCase {
  return new CreateProvisionalGuestContactUseCase({
    contacts: opts.contacts ?? new MongoContactRepository(),
    guestSessions: opts.guestSessions ?? buildMongoGuestSessionProvisionalLinkPort(),
    unitOfWork: opts.unitOfWork ?? new MongoUnitOfWork(),
    events: opts.events ?? kernelEventPublisher,
    audit: opts.audit,
    clock: opts.clock,
  });
}
