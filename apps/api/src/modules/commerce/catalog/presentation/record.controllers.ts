import { asId, type CategoryId, type ModifierGroupId } from "@banijjik/ids";
import type {
  CategoryCreateBody,
  CategoryListQuery,
  CategoryUpdateBody,
  ModifierGroupCreateBody,
  ModifierGroupListQuery,
  ModifierGroupUpdateBody,
  SynonymsUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ArchiveCategoryUseCase,
  CreateCategoryUseCase,
  GetCategoryUseCase,
  ListCategoriesUseCase,
  UpdateCategoryUseCase,
} from "../application/use-cases/category.use-cases.js";
import type {
  ArchiveModifierGroupUseCase,
  CreateModifierGroupUseCase,
  GetModifierGroupUseCase,
  ListModifierGroupsUseCase,
  UpdateModifierGroupUseCase,
} from "../application/use-cases/modifier-group.use-cases.js";
import type {
  GetSynonymsUseCase,
  UpdateSynonymsUseCase,
} from "../application/use-cases/synonym.use-cases.js";

const HTTP_CREATED = 201;

function readQuery<Query>(response: Response): Query {
  // Safe: validate({ query }) produced this value on the routes that call it.
  return response.locals["validated"].query as Query;
}

export interface CategoryControllerDependencies {
  readonly listCategories: ListCategoriesUseCase;
  readonly getCategory: GetCategoryUseCase;
  readonly createCategory: CreateCategoryUseCase;
  readonly updateCategory: UpdateCategoryUseCase;
  readonly archiveCategory: ArchiveCategoryUseCase;
}

function readCategoryId(request: Request): CategoryId {
  return asId<CategoryId>(String(request.params["categoryId"]));
}

/** Category endpoints (14-API.md section 5.3). */
export class CategoryController {
  constructor(private readonly dependencies: CategoryControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const { page, limit, status } = readQuery<CategoryListQuery>(response);
    const result = await this.dependencies.listCategories.execute({
      organizationId,
      page,
      limit,
      status,
    });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly get: RequestHandler = async (request, response) => {
    const { organizationId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.getCategory.execute({
        organizationId,
        categoryId: readCategoryId(request),
      }),
    );
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: CategoryCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const { parentCategoryId, ...rest } = body;
    const created = await this.dependencies.createCategory.execute({
      organizationId,
      actorUserId,
      ...rest,
      ...(parentCategoryId === undefined
        ? {}
        : { parentCategoryId: asId<CategoryId>(parentCategoryId) }),
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: CategoryUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const { parentCategoryId, ...rest } = body;
    sendData(
      response,
      await this.dependencies.updateCategory.execute({
        organizationId,
        actorUserId,
        categoryId: readCategoryId(request),
        ...rest,
        ...(parentCategoryId === undefined
          ? {}
          : {
              parentCategoryId:
                parentCategoryId === null ? null : asId<CategoryId>(parentCategoryId),
            }),
      }),
    );
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.archiveCategory.execute({
        organizationId,
        actorUserId,
        categoryId: readCategoryId(request),
        version: body.version,
      }),
    );
  };
}

export interface ModifierGroupControllerDependencies {
  readonly listGroups: ListModifierGroupsUseCase;
  readonly getGroup: GetModifierGroupUseCase;
  readonly createGroup: CreateModifierGroupUseCase;
  readonly updateGroup: UpdateModifierGroupUseCase;
  readonly archiveGroup: ArchiveModifierGroupUseCase;
}

function readGroupId(request: Request): ModifierGroupId {
  return asId<ModifierGroupId>(String(request.params["modifierGroupId"]));
}

/** Add-on group endpoints (14-API.md section 5.3, ADR-072). */
export class ModifierGroupController {
  constructor(private readonly dependencies: ModifierGroupControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { page, limit, status } = readQuery<ModifierGroupListQuery>(response);
    const result = await this.dependencies.listGroups.execute({ page, limit, status });
    sendData(response, result.items, { meta: { page, limit, hasNext: result.hasNext } });
  };

  readonly get: RequestHandler = async (request, response) => {
    sendData(
      response,
      await this.dependencies.getGroup.execute({ modifierGroupId: readGroupId(request) }),
    );
  };

  readonly create: RequestHandler = async (request, response) => {
    const body: ModifierGroupCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const created = await this.dependencies.createGroup.execute({
      organizationId,
      actorUserId,
      ...body,
    });
    sendData(response, created, { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: ModifierGroupUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.updateGroup.execute({
        organizationId,
        actorUserId,
        modifierGroupId: readGroupId(request),
        ...body,
      }),
    );
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.archiveGroup.execute({
        organizationId,
        actorUserId,
        modifierGroupId: readGroupId(request),
        version: body.version,
      }),
    );
  };
}

export interface SynonymControllerDependencies {
  readonly getSynonyms: GetSynonymsUseCase;
  readonly updateSynonyms: UpdateSynonymsUseCase;
}

/** `GET` and `PUT /catalog/synonyms`. */
export class SynonymController {
  constructor(private readonly dependencies: SynonymControllerDependencies) {}

  readonly get: RequestHandler = async (_request, response) => {
    sendData(response, await this.dependencies.getSynonyms.execute());
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: SynonymsUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    sendData(
      response,
      await this.dependencies.updateSynonyms.execute({
        organizationId,
        actorUserId,
        entries: body.entries,
        version: body.version,
      }),
    );
  };
}
