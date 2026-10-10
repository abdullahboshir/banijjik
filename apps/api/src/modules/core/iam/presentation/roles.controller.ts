import type {
  PaginationQuery,
  RoleArchiveBody,
  RoleCreateBody,
  RoleUpdateBody,
} from "@banijjik/validation";
import { asId, type RoleId } from "@banijjik/ids";
import type { Request, RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type { ArchiveRoleUseCase } from "../application/use-cases/archive-role.use-case.js";
import type { CreateRoleUseCase } from "../application/use-cases/create-role.use-case.js";
import type { ListRolesUseCase } from "../application/use-cases/list-roles.use-case.js";
import type { UpdateRoleUseCase } from "../application/use-cases/update-role.use-case.js";
import { toRoleResponse, toRoleSummary } from "./role-response.transformer.js";
import { readTenantCaller } from "./tenant-caller.js";

export interface RolesControllerDependencies {
  readonly listRoles: ListRolesUseCase;
  readonly createRole: CreateRoleUseCase;
  readonly updateRole: UpdateRoleUseCase;
  readonly archiveRole: ArchiveRoleUseCase;
}

const HTTP_CREATED = 201;

function readRoleId(request: Request): RoleId {
  // validate() already parsed the path parameter with the role-id schema.
  return asId<RoleId>(String(request.params["roleId"]));
}

/** validate() stores the parsed query here, because Express 5 makes request.query read-only. */
function readPagination(response: Response): PaginationQuery {
  // Safe: validate({ query: paginationQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as PaginationQuery;
}

export class RolesController {
  constructor(private readonly dependencies: RolesControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    const { page, limit } = readPagination(response);
    const result = await this.dependencies.listRoles.execute({ page, limit });
    sendData(response, result.items.map(toRoleSummary), {
      meta: { page, limit, hasNext: result.hasNext },
    });
  };

  readonly create: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the role-create schema.
    const body: RoleCreateBody = request.body;
    const view = await this.dependencies.createRole.execute({
      ...readTenantCaller(),
      name: body.name,
      permissionKeys: body.permissionKeys,
    });
    sendData(response, toRoleResponse(view), { status: HTTP_CREATED });
  };

  readonly update: RequestHandler = async (request, response) => {
    const body: RoleUpdateBody = request.body;
    const view = await this.dependencies.updateRole.execute({
      ...readTenantCaller(),
      roleId: readRoleId(request),
      version: body.version,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.permissionKeys === undefined ? {} : { permissionKeys: body.permissionKeys }),
    });
    sendData(response, toRoleResponse(view));
  };

  readonly archive: RequestHandler = async (request, response) => {
    const body: RoleArchiveBody = request.body;
    const view = await this.dependencies.archiveRole.execute({
      ...readTenantCaller(),
      roleId: readRoleId(request),
      version: body.version,
    });
    sendData(response, toRoleResponse(view));
  };
}
