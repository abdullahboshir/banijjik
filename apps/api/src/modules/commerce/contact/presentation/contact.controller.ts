import { asId, type ContactId } from "@banijjik/ids";
import type {
  ContactAnonymizeBody,
  ContactCreateBody,
  ContactListQuery,
  ContactUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { CreateContactUseCase } from "../application/use-cases/create-contact.use-case.js";
import type {
  AnonymizeContactUseCase,
  ArchiveContactUseCase,
} from "../application/use-cases/end-contact.use-cases.js";
import type { GetContactUseCase } from "../application/use-cases/get-contact.use-case.js";
import type { ListContactsUseCase } from "../application/use-cases/list-contacts.use-case.js";
import type { UpdateContactUseCase } from "../application/use-cases/update-contact.use-case.js";
import { toContactListItem, toContactResponse } from "./contact.transformer.js";

const HTTP_CREATED = 201;

export interface ContactControllerDependencies {
  readonly listContacts: ListContactsUseCase;
  readonly getContact: GetContactUseCase;
  readonly createContact: CreateContactUseCase;
  readonly updateContact: UpdateContactUseCase;
  readonly archiveContact: ArchiveContactUseCase;
  readonly anonymizeContact: AnonymizeContactUseCase;
}

function readContactId(request: Request): ContactId {
  // validate() already parsed the path parameter with the contact-id schema.
  return asId<ContactId>(String(request.params["contactId"]));
}

function readQuery(response: Response): ContactListQuery {
  // Safe: validate({ query: contactListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as ContactListQuery;
}

/** Contact endpoints (14-API.md section 5.3). */
export class ContactController {
  constructor(private readonly dependencies: ContactControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { page, limit, ...filters } = readQuery(response);
    const result = await this.dependencies.listContacts.execute({ page, limit, ...filters });
    sendData(response, result.items.map(toContactListItem), {
      meta: { page, limit, hasNext: result.hasNext },
    });
  };

  readonly get: RequestHandler = async (request, response) => {
    const { organizationId } = readTenantCaller();
    const view = await this.dependencies.getContact.execute({
      organizationId,
      contactId: readContactId(request),
    });
    sendData(response, toContactResponse(view));
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: ContactCreateBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const view = await this.dependencies.createContact.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      ...body,
    });
    sendData(response, toContactResponse(view), { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: ContactUpdateBody = request.body;
    const { organizationId, actorUserId, allowedLocationIds } = readTenantCaller();
    const view = await this.dependencies.updateContact.execute({
      organizationId,
      actorUserId,
      allowedLocationIds,
      contactId: readContactId(request),
      ...body,
    });
    sendData(response, toContactResponse(view));
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const view = await this.dependencies.archiveContact.execute({
      organizationId,
      actorUserId,
      contactId: readContactId(request),
      version: body.version,
    });
    sendData(response, toContactResponse(view));
  };

  readonly anonymize: RequestHandler = async (request, response) => {
    const body: ContactAnonymizeBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const view = await this.dependencies.anonymizeContact.execute({
      organizationId,
      actorUserId,
      contactId: readContactId(request),
      version: body.version,
      reason: body.reason,
    });
    sendData(response, toContactResponse(view));
  };
}
