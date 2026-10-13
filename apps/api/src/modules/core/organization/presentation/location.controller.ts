import { asId, type LocationId } from "@banijjik/ids";
import type {
  LocationCreateBody,
  LocationListQuery,
  LocationUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { readTenantCaller } from "../../../../kernel/access/index.js";
import { sendData } from "../../../../kernel/http/index.js";
import type { ArchiveLocationUseCase } from "../application/use-cases/archive-location.use-case.js";
import type { CreateLocationUseCase } from "../application/use-cases/create-location.use-case.js";
import type { ListLocationsUseCase } from "../application/use-cases/list-locations.use-case.js";
import type { UpdateLocationUseCase } from "../application/use-cases/update-location.use-case.js";
import { toLocationResponse } from "./location.transformer.js";

const HTTP_CREATED = 201;

export interface LocationControllerDependencies {
  readonly listLocations: ListLocationsUseCase;
  readonly createLocation: CreateLocationUseCase;
  readonly updateLocation: UpdateLocationUseCase;
  readonly archiveLocation: ArchiveLocationUseCase;
}

function readLocationId(request: Request): LocationId {
  // validate() already parsed the path parameter with the location-id schema.
  return asId<LocationId>(String(request.params["locationId"]));
}

function readQuery(response: Response): LocationListQuery {
  // Safe: validate({ query: locationListQuerySchema }) produced this value on this route.
  return response.locals["validated"].query as LocationListQuery;
}

/** Location endpoints (14-API.md section 5.1). */
export class LocationController {
  constructor(private readonly dependencies: LocationControllerDependencies) {}

  readonly listLocations: RequestHandler = async (_request, response) => {
    const { page, limit, status } = readQuery(response);
    const { allowedLocationIds } = readTenantCaller();
    const result = await this.dependencies.listLocations.execute({
      page,
      limit,
      visibleLocationIds: allowedLocationIds,
      ...(status === undefined ? {} : { status }),
    });
    sendData(response, result.items.map(toLocationResponse), {
      meta: { page, limit, hasNext: result.hasNext },
    });
  };

  readonly createLocation: RequestHandler = async (request, response) => {
    const body: LocationCreateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const location = await this.dependencies.createLocation.execute({
      organizationId,
      actorUserId,
      name: body.name,
      locationType: body.locationType,
      ...(body.address === undefined ? {} : { address: body.address }),
      ...(body.phoneE164 === undefined ? {} : { phoneE164: body.phoneE164 }),
      ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
    });
    sendData(response, toLocationResponse(location), { status: HTTP_CREATED });
  };

  readonly updateLocation: RequestHandler = async (request, response) => {
    const { version, ...changes }: LocationUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const location = await this.dependencies.updateLocation.execute({
      organizationId,
      actorUserId,
      locationId: readLocationId(request),
      version,
      changes,
    });
    sendData(response, toLocationResponse(location));
  };

  readonly archiveLocation: RequestHandler = async (request, response) => {
    const body: VersionedTransitionBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const location = await this.dependencies.archiveLocation.execute({
      organizationId,
      actorUserId,
      locationId: readLocationId(request),
      version: body.version,
    });
    sendData(response, toLocationResponse(location));
  };
}
