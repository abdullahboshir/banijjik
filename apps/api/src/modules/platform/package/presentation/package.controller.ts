import type {
  PlatformPackageCreateBody,
  PlatformPackageListQuery,
  PlatformPackageUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { RequestHandler, Response } from "express";
import { requireCurrentUserId } from "../../../../kernel/auth/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ArchivePackageUseCase,
  CreatePackageUseCase,
  GetPackageUseCase,
  ListPackagesUseCase,
  UpdatePackageUseCase,
} from "../application/use-cases/package-admin.use-cases.js";
import type { LimitIncrements } from "../domain/package.entity.js";
import { toPackageResponse } from "./package.transformer.js";

export interface PackageControllerDependencies {
  readonly listPackages: ListPackagesUseCase;
  readonly getPackage: GetPackageUseCase;
  readonly createPackage: CreatePackageUseCase;
  readonly updatePackage: UpdatePackageUseCase;
  readonly archivePackage: ArchivePackageUseCase;
}

/** validate() stores the parsed query and params here, because Express 5 makes request.query read-only. */
function validatedPackageId(response: Response): string {
  // Safe: validate({ params: platformPackageParamsSchema }) produced this value on these routes.
  return (response.locals["validated"].params as { packageId: string }).packageId;
}

/** The schema output allows `undefined` values; the domain type has absent keys instead. */
function toIncrements(raw: object): LimitIncrements {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));
}

export class PackageController {
  constructor(private readonly dependencies: PackageControllerDependencies) {}

  readonly list: RequestHandler = async (_request, response) => {
    // Safe: validate({ query: platformPackageListQuerySchema }) produced this value on this route.
    const query = response.locals["validated"].query as PlatformPackageListQuery;
    const page = await this.dependencies.listPackages.execute(query);
    sendData(response, page.items.map(toPackageResponse), {
      meta: { page: query.page, limit: query.limit, hasNext: page.hasNext },
    });
  };

  readonly get: RequestHandler = async (_request, response) => {
    const detail = await this.dependencies.getPackage.execute({
      packageId: validatedPackageId(response),
    });
    sendData(response, toPackageResponse(detail));
  };

  readonly create: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the create schema.
    const body: PlatformPackageCreateBody = request.body;
    const detail = await this.dependencies.createPackage.execute({
      actorUserId: requireCurrentUserId(),
      packageKey: body.packageKey,
      name: body.name,
      isAddOn: body.isAddOn,
      moduleKeys: body.moduleKeys,
      limits: body.limits,
      limitIncrements: toIncrements(body.limitIncrements ?? {}),
    });
    sendData(response, toPackageResponse(detail), { status: 201 });
  };

  readonly update: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the update schema.
    const body: PlatformPackageUpdateBody = request.body;
    const detail = await this.dependencies.updatePackage.execute({
      actorUserId: requireCurrentUserId(),
      packageId: validatedPackageId(response),
      version: body.version,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.moduleKeys === undefined ? {} : { moduleKeys: body.moduleKeys }),
      ...(body.limits === undefined ? {} : { limits: body.limits }),
      ...(body.limitIncrements === undefined
        ? {}
        : { limitIncrements: toIncrements(body.limitIncrements) }),
    });
    sendData(response, toPackageResponse(detail));
  };

  readonly archive: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the versioned-transition schema.
    const body: VersionedTransitionBody = request.body;
    const detail = await this.dependencies.archivePackage.execute({
      actorUserId: requireCurrentUserId(),
      packageId: validatedPackageId(response),
      version: body.version,
    });
    sendData(response, toPackageResponse(detail));
  };
}
