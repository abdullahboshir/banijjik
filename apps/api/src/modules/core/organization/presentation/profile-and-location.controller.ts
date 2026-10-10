import { asId, type LocationId } from "@banijjik/ids";
import type {
  LocationCreateBody,
  LocationListQuery,
  LocationUpdateBody,
  ProfileUpdateBody,
  VersionedTransitionBody,
} from "@banijjik/validation";
import type { Request, RequestHandler, Response } from "express";
import { sendData } from "../../../../kernel/http/index.js";
import type {
  ArchiveLocationUseCase,
  CreateLocationUseCase,
  ListLocationsUseCase,
  UpdateLocationUseCase,
} from "../application/use-cases/location.use-cases.js";
import type {
  GetProfileUseCase,
  UpdateProfileUseCase,
} from "../application/use-cases/profile.use-cases.js";
import { toLocationResponse, toProfileResponse } from "./profile-and-location.transformers.js";
import { readTenantCaller } from "./tenant-caller.js";

const HTTP_CREATED = 201;

export interface ProfileAndLocationControllerDependencies {
  readonly getProfile: GetProfileUseCase;
  readonly updateProfile: UpdateProfileUseCase;
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

/** Business profile and location endpoints (14-API.md section 5.1). */
export class ProfileAndLocationController {
  constructor(private readonly dependencies: ProfileAndLocationControllerDependencies) {}

  readonly getProfile: RequestHandler = async (_request, response) => {
    const { organizationId } = readTenantCaller();
    const organization = await this.dependencies.getProfile.execute({ organizationId });
    sendData(response, toProfileResponse(organization));
  };

  readonly updateProfile: RequestHandler = async (request, response) => {
    // validate() already parsed the body with the profile-update schema.
    const body: ProfileUpdateBody = request.body;
    const { organizationId, actorUserId } = readTenantCaller();
    const organization = await this.dependencies.updateProfile.execute({
      organizationId,
      actorUserId,
      version: body.version,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.defaultLocale === undefined ? {} : { defaultLocale: body.defaultLocale }),
      ...(body.profile === undefined ? {} : { profile: body.profile }),
    });
    sendData(response, toProfileResponse(organization));
  };

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
