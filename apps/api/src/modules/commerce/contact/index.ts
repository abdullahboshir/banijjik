import type { RequestHandler, Router } from "express";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import type { PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { ContactWriteDependencies } from "./application/contact-dependencies.js";
import type {
  ContactCustomFieldReader,
  SensitiveValueAccess,
} from "./application/ports/custom-field-ports.js";
import type {
  DedupeModeReader,
  HomeLocationLookup,
} from "./application/ports/settings-and-locations.js";
import { CreateContactUseCase } from "./application/use-cases/create-contact.use-case.js";
import {
  AnonymizeContactUseCase,
  ArchiveContactUseCase,
} from "./application/use-cases/end-contact.use-cases.js";
import { GetContactUseCase } from "./application/use-cases/get-contact.use-case.js";
import { ListContactsUseCase } from "./application/use-cases/list-contacts.use-case.js";
import { UpdateContactUseCase } from "./application/use-cases/update-contact.use-case.js";
import { MongoContactRepository } from "./infrastructure/mongo-contact.repository.js";
import { ContactController } from "./presentation/contact.controller.js";
import { buildContactTenantRouter } from "./presentation/contact-tenant.router.js";

export { contactManifest } from "./module.manifest.js";
export { registerContactModels } from "./infrastructure/register-contact-models.js";
export type {
  ContactCustomFieldReader,
  SensitiveValueAccess,
  DedupeModeReader,
  HomeLocationLookup,
};

export interface ContactTenantDependencies {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  /** The `Idempotency-Key` middleware, built once by routes/v1.ts. */
  readonly idempotency: RequestHandler;
  /** Adapters over other modules (custom-field, settings, organization), supplied by routes. */
  readonly customFields: ContactCustomFieldReader;
  readonly sensitiveAccess: SensitiveValueAccess;
  readonly dedupeModes: DedupeModeReader;
  readonly locations: HomeLocationLookup;
}

/** Composition root: repository, use cases and router are wired here and nowhere else. */
export function buildContactRouter(dependencies: ContactTenantDependencies): Router {
  const contacts = new MongoContactRepository();
  const write: ContactWriteDependencies = {
    contacts,
    unitOfWork: new MongoUnitOfWork(),
    events: kernelEventPublisher,
    audit: dependencies.audit,
    clock: dependencies.clock,
    customFields: dependencies.customFields,
    sensitiveAccess: dependencies.sensitiveAccess,
    dedupeModes: dependencies.dedupeModes,
  };
  const withLocations = { ...write, locations: dependencies.locations };
  const controller = new ContactController({
    listContacts: new ListContactsUseCase(contacts),
    getContact: new GetContactUseCase({
      contacts,
      customFields: dependencies.customFields,
      sensitiveAccess: dependencies.sensitiveAccess,
    }),
    createContact: new CreateContactUseCase(withLocations),
    updateContact: new UpdateContactUseCase(withLocations),
    archiveContact: new ArchiveContactUseCase(write),
    anonymizeContact: new AnonymizeContactUseCase(write),
  });
  return buildContactTenantRouter({
    contacts: controller,
    permission: dependencies.permission,
    idempotency: dependencies.idempotency,
  });
}
