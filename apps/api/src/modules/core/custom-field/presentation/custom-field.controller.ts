import type {
  CustomFieldArchiveRequest,
  CustomFieldDefinitionCreateRequest,
  CustomFieldDefinitionUpdateRequest,
  CustomFieldListQuery,
  CustomFieldPreferenceBatchRequest,
} from "@banijjik/contracts";
import { asId } from "@banijjik/ids";
import type { Request, RequestHandler, Response } from "express";
import { readTenantIdentity } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { CustomFieldDefinitionId } from "../domain/custom-field-definition.entity.js";
import type { ArchiveCustomFieldDefinitionUseCase } from "../application/use-cases/archive-custom-field-definition.use-case.js";
import type { CreateCustomFieldDefinitionUseCase } from "../application/use-cases/create-custom-field-definition.use-case.js";
import type { ListCustomFieldsUseCase } from "../application/use-cases/list-custom-fields.use-case.js";
import type { UpdateCustomFieldDefinitionUseCase } from "../application/use-cases/update-custom-field-definition.use-case.js";
import type { UpdateCustomFieldPreferencesUseCase } from "../application/use-cases/update-custom-field-preferences.use-case.js";

const HTTP_CREATED = 201;

export interface CustomFieldControllerDependencies {
  readonly listFields: ListCustomFieldsUseCase;
  readonly createField: CreateCustomFieldDefinitionUseCase;
  readonly updateField: UpdateCustomFieldDefinitionUseCase;
  readonly archiveField: ArchiveCustomFieldDefinitionUseCase;
  readonly updatePreferences: UpdateCustomFieldPreferencesUseCase;
}

function readDefinitionId(request: Request): CustomFieldDefinitionId {
  return asId<CustomFieldDefinitionId>(String(request.params["customFieldDefinitionId"]));
}

function readListQuery(response: Response): CustomFieldListQuery {
  // Safe: validate({ query: customFieldListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as CustomFieldListQuery;
}

export class CustomFieldController {
  constructor(private readonly dependencies: CustomFieldControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const query = readListQuery(response);
    const page = await this.dependencies.listFields.execute({
      ...readTenantIdentity(),
      ...query,
    });
    sendData(response, page.items, {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: CustomFieldDefinitionCreateRequest = request.body;
    const created = await this.dependencies.createField.execute({
      ...readTenantIdentity(),
      ...body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: CustomFieldDefinitionUpdateRequest = request.body;
    const { version, ...changes } = body;
    const updated = await this.dependencies.updateField.execute({
      ...readTenantIdentity(),
      customFieldDefinitionId: readDefinitionId(request),
      version,
      changes,
    });
    sendData(response, updated);
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: CustomFieldArchiveRequest = request.body;
    const archived = await this.dependencies.archiveField.execute({
      ...readTenantIdentity(),
      customFieldDefinitionId: readDefinitionId(request),
      version: body.version,
    });
    sendData(response, archived);
  };

  readonly preferences: RequestHandler = async (request, response) => {
    const body: CustomFieldPreferenceBatchRequest = request.body;
    const saved = await this.dependencies.updatePreferences.execute({
      ...readTenantIdentity(),
      preferences: body.preferences,
    });
    sendData(response, saved);
  };
}
